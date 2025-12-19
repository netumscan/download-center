let CATALOG = null;
let ASSET_BY_ID = new Map();

const $ = (id) => document.getElementById(id);

function normalizePlatformLabel(p){
  const m = { windows:"Windows", macos:"macOS", linux:"Linux", android:"Android", ios:"iOS" };
  return m[p] || p;
}

function tag(text){ return `<span class="tag">${text}</span>`; }

async function loadCatalog(){
  const res = await fetch("/api/catalog", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load catalog");
  const catalog = await res.json();
  return catalog;
}

function buildIndex(catalog){
  ASSET_BY_ID = new Map();
  for (const a of (catalog.assets || [])) ASSET_BY_ID.set(a.id, a);
}

function setActiveTab(which){
  const isAssets = which === "assets";
  $("view-assets").style.display = isAssets ? "" : "none";
  $("view-devices").style.display = isAssets ? "none" : "";
  $("tab-assets").classList.toggle("active", isAssets);
  $("tab-devices").classList.toggle("active", !isAssets);
}

function initTabs(){
  $("tab-assets").onclick = () => setActiveTab("assets");
  $("tab-devices").onclick = () => setActiveTab("devices");
}

function initAssetsFilters(){
  const cat = $("asset-category");
  const platform = $("asset-platform");
  const subtype = $("asset-subtype");

  function resetOptions(sel, pairs){
    sel.innerHTML = "";
    for (const [v, t] of pairs){
      const o = document.createElement("option");
      o.value = v; o.textContent = t;
      sel.appendChild(o);
    }
  }

  function applyFilterOptions(){
    const c = cat.value;

    // platform options
    if (c === "desktop"){
      resetOptions(platform, [["windows","Windows"],["macos","macOS"],["linux","Linux"],["","全部"]]);
      resetOptions(subtype, [["","全部"],["app","软件"],["driver","驱动"]]);
      $("asset-platform-label").style.display = "";
      platform.style.display = "";
      $("asset-subtype-label").style.display = "";
      subtype.style.display = "";
    } else if (c === "mobile"){
      resetOptions(platform, [["android","Android"],["ios","iOS"],["","全部"]]);
      resetOptions(subtype, [["","全部"],["app","APP"]]);
      $("asset-platform-label").style.display = "";
      platform.style.display = "";
      $("asset-subtype-label").style.display = "";
      subtype.style.display = "";
    } else { // docs
      resetOptions(platform, [["","全部"]]);
      resetOptions(subtype, [["","全部"],["manual","使用文档"],["spec","规格说明"]]);
      $("asset-platform-label").style.display = "none";
      platform.style.display = "none";
      $("asset-subtype-label").style.display = "";
      subtype.style.display = "";
    }
  }

  cat.onchange = () => { applyFilterOptions(); renderAssets(); };
  platform.onchange = renderAssets;
  subtype.onchange = renderAssets;
  $("asset-q").oninput = renderAssets;
  $("asset-refresh").onclick = async () => { await bootstrap(); };

  applyFilterOptions();
}

function renderAssets(){
  const tbody = $("asset-tbody");
  if (!CATALOG){ tbody.innerHTML = `<tr><td colspan="4">加载中...</td></tr>`; return; }

  const c = $("asset-category").value;
  const p = $("asset-platform").value;
  const st = $("asset-subtype").value;
  const q = ($("asset-q").value || "").toLowerCase();

  const rows = (CATALOG.assets || []).filter(a => {
    if (a.category !== c) return false;
    if (p && a.platform && a.platform !== p) return false;
    if (st && a.subtype !== st) return false;
    if (c === "docs" && a.format && a.format !== "pdf") return false;
    const s = `${a.name||""} ${a.version||""} ${a.platform||""} ${a.arch||""}`.toLowerCase();
    if (q && !s.includes(q)) return false;
    return true;
  });

  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="4">无数据</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(a => {
    const tags = [];
    if (a.platform) tags.push(normalizePlatformLabel(a.platform));
    if (a.arch) tags.push(a.arch);
    if (a.subtype) tags.push(a.subtype.toUpperCase());
    if (a.type) tags.push(a.type.toUpperCase());
    if (a.format) tags.push(a.format.toUpperCase());
    const tagHtml = tags.map(tag).join(" ");
    return `<tr>
      <td>
        <div>${a.name || ""}</div>
        <div class="small">${a.id}</div>
      </td>
      <td>${a.version || ""}</td>
      <td>${tagHtml}</td>
      <td><a href="/d/${encodeURIComponent(a.id)}">下载</a></td>
    </tr>`;
  }).join("");
}

function initDeviceSelectors(){
  const typeSel = $("device-type");
  const modelSel = $("device-model");

  function setOptions(sel, items, getValue, getText){
    sel.innerHTML = "";
    for (const it of items){
      const o = document.createElement("option");
      o.value = getValue(it);
      o.textContent = getText(it);
      sel.appendChild(o);
    }
  }

  function getDeviceTypeList(){
    return (CATALOG.devices || []).map(d => ({ key: d.deviceType, name: d.name, models: d.models || [] }));
  }

  function refreshModels(){
    const types = getDeviceTypeList();
    const selectedKey = typeSel.value;
    const dt = types.find(t => t.key === selectedKey);
    const models = dt?.models || [];
    setOptions(modelSel, models, m => m.model, m => m.model);
    renderDeviceLinks();
  }

  typeSel.onchange = refreshModels;
  modelSel.onchange = renderDeviceLinks;
  $("device-q").oninput = renderDeviceLinks;

  // init
  const types = getDeviceTypeList();
  setOptions(typeSel, types, t => t.key, t => t.name);
  refreshModels();
}

function renderDeviceLinks(){
  const tbody = $("device-tbody");
  if (!CATALOG){ tbody.innerHTML = `<tr><td colspan="3">加载中...</td></tr>`; return; }

  const typeKey = $("device-type").value;
  const modelName = $("device-model").value;
  const q = ($("device-q").value || "").toLowerCase();

  const dt = (CATALOG.devices || []).find(d => d.deviceType === typeKey);
  const model = (dt?.models || []).find(m => m.model === modelName);

  const title = model ? `${dt?.name || ""} · ${model.model}` : "型号资源";
  $("device-title").textContent = title;

  const links = (model?.links || []).slice().sort((a,b) => (a.sort||0) - (b.sort||0));
  const rows = links.map(l => {
    const a = ASSET_BY_ID.get(l.assetId);
    if (!a) return { ok:false, label:l.label, role:l.role, assetId:l.assetId };
    const summary = `${a.name||""} ${a.version||""} ${a.platform||""} ${a.arch||""}`.toLowerCase();
    return { ok:true, link:l, asset:a, summary };
  }).filter(x => {
    if (!q) return true;
    const text = x.ok ? `${x.link.label||""} ${x.asset.name||""} ${x.asset.platform||""} ${x.asset.arch||""} ${x.asset.subtype||""}`.toLowerCase()
                      : `${x.label||""} ${x.assetId||""}`.toLowerCase();
    return text.includes(q);
  });

  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="3">无关联资源</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(x => {
    if (!x.ok){
      return `<tr>
        <td>${x.label || ""}<div class="small">缺失 assetId：${x.assetId}</div></td>
        <td>${tag("MISSING")}</td>
        <td>-</td>
      </tr>`;
    }

    const a = x.asset;
    const l = x.link;
    const tags = [];
    if (l.role) tags.push(l.role.toUpperCase());
    if (a.platform) tags.push(normalizePlatformLabel(a.platform));
    if (a.arch) tags.push(a.arch);
    if (a.subtype) tags.push(a.subtype.toUpperCase());
    if (a.type) tags.push(a.type.toUpperCase());
    if (a.format) tags.push(a.format.toUpperCase());
    const tagHtml = tags.map(tag).join(" ");

    return `<tr>
      <td>
        <div>${l.label || a.name || ""}</div>
        <div class="small">${a.id}</div>
      </td>
      <td>${tagHtml}</td>
      <td><a href="/d/${encodeURIComponent(a.id)}">下载</a></td>
    </tr>`;
  }).join("");
}

async function bootstrap(){
  try{
    CATALOG = await loadCatalog();
    buildIndex(CATALOG);
    renderAssets();
    initDeviceSelectors();
  }catch(e){
    console.error(e);
    $("asset-tbody").innerHTML = `<tr><td colspan="4">加载失败：${e.message}</td></tr>`;
    $("device-tbody").innerHTML = `<tr><td colspan="3">加载失败：${e.message}</td></tr>`;
  }
}

function main(){
  initTabs();
  initAssetsFilters();
  bootstrap();
}

main();
