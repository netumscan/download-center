const $ = id => document.getElementById(id);
const TOKEN_KEY = "admin_token";
const DEVICE_TYPES = [
  { value: "scanner", label: "扫描枪" },
  { value: "printer", label: "打印机" },
  { value: "photo_printer", label: "拍印机" },
  { value: "document_scanner", label: "高拍仪" }
];

let state = {
  catalog: { assets: [], devices: [] },
  versionId: null
};

function loadSavedToken() {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  $("admin-token").value = token;
  $("auth-status").textContent = token ? "Token 已加载（仅保存在浏览器）" : "未保存 Token";
}

function saveToken() {
  const token = $("admin-token").value.trim();
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    $("auth-status").textContent = "Token 已保存";
  } else {
    localStorage.removeItem(TOKEN_KEY);
    $("auth-status").textContent = "Token 已清除";
  }
}

function getToken() {
  const token = $("admin-token").value.trim() || localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("缺少 Admin Token");
  return token;
}

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `请求失败 ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

function downloadJson(data, filename = "catalog.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderAssets() {
  const tbody = $("assets-body");
  const assets = state.catalog.assets || [];
  const rows = assets
    .map((a, idx) => {
      const platforms =
        a.category === "desktop"
          ? ["", "windows", "macos", "linux"]
          : a.category === "mobile"
          ? ["", "android", "ios"]
          : [""];
      const subtypes =
        a.category === "docs"
          ? ["manual", "spec"]
          : a.category === "desktop"
          ? ["app", "driver"]
          : ["app"];

      return `<tr data-idx="${idx}">
        <td>
          <input value="${a.id || ""}" data-field="id" placeholder="id" size="20"/>
          <div class="small"><input value="${a.name || ""}" data-field="name" placeholder="名称" size="20"/></div>
        </td>
        <td>
          <select data-field="category">
            ${["desktop", "mobile", "docs"].map(v => `<option value="${v}" ${a.category===v?"selected":""}>${v}</option>`).join("")}
          </select>
          <select data-field="subtype">
            ${subtypes.map(v => `<option value="${v}" ${a.subtype===v?"selected":""}>${v}</option>`).join("")}
          </select>
        </td>
        <td>
          <select data-field="platform">
            ${platforms.map(v => `<option value="${v}" ${a.platform===v?"selected":""}>${v||"全部"}</option>`).join("")}
          </select>
          <input value="${a.arch || ""}" data-field="arch" placeholder="arch" size="6"/>
        </td>
        <td>
          <select data-field="type">
            ${["direct","s3"].map(v => `<option value="${v}" ${a.type===v?"selected":""}>${v}</option>`).join("")}
          </select>
          <div><input value="${a.url || ""}" data-field="url" placeholder="url" size="28"/></div>
          <div class="small">
            <input value="${a.version || ""}" data-field="version" placeholder="version" size="10"/>
            <input value="${a.format || ""}" data-field="format" placeholder="format" size="6"/>
          </div>
        </td>
        <td><button data-action="del-asset">删除</button></td>
      </tr>`;
    })
    .join("");
  tbody.innerHTML = rows || `<tr><td colspan="5">暂无资源</td></tr>`;

  tbody.querySelectorAll("input,select").forEach(el => {
    el.onchange = ev => {
      const tr = ev.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      const field = ev.target.dataset.field;
      if (field) state.catalog.assets[idx][field] = ev.target.value.trim();
    };
  });
  tbody.querySelectorAll("button[data-action='del-asset']").forEach(btn => {
    btn.onclick = ev => {
      const tr = ev.target.closest("tr");
      const idx = Number(tr.dataset.idx);
      state.catalog.assets.splice(idx, 1);
      renderAssets();
    };
  });
}

function renderDevices() {
  const container = $("devices-container");
  const devices = state.catalog.devices || [];
  container.innerHTML = devices
    .map((d, di) => {
      const models = d.models || [];
      const modelsHtml = models
        .map((m, mi) => {
          const links = m.links || [];
          const linksHtml = links
            .map((l, li) => {
              return `<div class="row" data-li="${li}">
                <input data-field="label" value="${l.label || ""}" placeholder="label" size="14"/>
                <input data-field="assetId" value="${l.assetId || ""}" placeholder="assetId" size="18" list="asset-ids"/>
                <input data-field="role" value="${l.role || ""}" placeholder="role" size="8"/>
                <input data-field="sort" value="${l.sort ?? ""}" placeholder="sort" size="4"/>
                <button data-action="del-link">删除关联</button>
              </div>`;
            })
            .join("");

          return `<div class="card" data-mi="${mi}">
            <div class="row">
              <input data-field="model" value="${m.model || ""}" placeholder="型号名称" size="20"/>
              <button data-action="add-link">新增关联</button>
              <button data-action="del-model">删除型号</button>
            </div>
            ${linksHtml || '<div class="small">暂无关联</div>'}
          </div>`;
        })
        .join("");

      const deviceTypeOptions = DEVICE_TYPES.map(opt => `<option value="${opt.value}" ${opt.value===d.deviceType?"selected":""}>${opt.label}</option>`).join("");

      return `<div class="card" data-di="${di}">
        <div class="row">
          <select data-field="deviceType">${deviceTypeOptions}</select>
          <input data-field="name" value="${d.name || ""}" placeholder="设备名称（可选）" size="20"/>
          <button data-action="add-model">新增型号</button>
          <button data-action="del-device">删除设备</button>
        </div>
        ${modelsHtml || '<div class="small">暂无型号</div>'}
      </div>`;
    })
    .join("");

  container.querySelectorAll("select[data-field],input[data-field]").forEach(el => {
    el.onchange = ev => {
      const card = ev.target.closest("[data-di]");
      if (!card) return;
      const di = Number(card.dataset.di);
      const field = ev.target.dataset.field;
      if (field === "deviceType" || field === "name") {
        state.catalog.devices[di][field] = ev.target.value.trim();
      } else if (field === "model") {
        const mi = Number(ev.target.closest("[data-mi]").dataset.mi);
        state.catalog.devices[di].models[mi].model = ev.target.value.trim();
      } else {
        const mi = Number(ev.target.closest("[data-mi]").dataset.mi);
        const li = Number(ev.target.closest("[data-li]").dataset.li);
        state.catalog.devices[di].models[mi].links[li][field] = ev.target.value.trim();
      }
    };
  });

  container.querySelectorAll("button[data-action='add-model']").forEach(btn => {
    btn.onclick = ev => {
      const di = Number(ev.target.closest("[data-di]").dataset.di);
      state.catalog.devices[di].models = state.catalog.devices[di].models || [];
      state.catalog.devices[di].models.push({ model: "", links: [] });
      renderDevices();
    };
  });
  container.querySelectorAll("button[data-action='del-model']").forEach(btn => {
    btn.onclick = ev => {
      const card = ev.target.closest("[data-di]");
      const di = Number(card.dataset.di);
      const mi = Number(ev.target.closest("[data-mi]").dataset.mi);
      state.catalog.devices[di].models.splice(mi, 1);
      renderDevices();
    };
  });
  container.querySelectorAll("button[data-action='add-link']").forEach(btn => {
    btn.onclick = ev => {
      const di = Number(ev.target.closest("[data-di]").dataset.di);
      const mi = Number(ev.target.closest("[data-mi]").dataset.mi);
      state.catalog.devices[di].models[mi].links = state.catalog.devices[di].models[mi].links || [];
      state.catalog.devices[di].models[mi].links.push({ label: "", assetId: "", role: "", sort: "" });
      renderDevices();
    };
  });
  container.querySelectorAll("button[data-action='del-link']").forEach(btn => {
    btn.onclick = ev => {
      const di = Number(ev.target.closest("[data-di]").dataset.di);
      const mi = Number(ev.target.closest("[data-mi]").dataset.mi);
      const li = Number(ev.target.closest("[data-li]").dataset.li);
      state.catalog.devices[di].models[mi].links.splice(li, 1);
      renderDevices();
    };
  });
  container.querySelectorAll("button[data-action='del-device']").forEach(btn => {
    btn.onclick = ev => {
      const di = Number(ev.target.closest("[data-di]").dataset.di);
      state.catalog.devices.splice(di, 1);
      renderDevices();
    };
  });
}

function buildCatalogFromUI() {
  const assets = (state.catalog.assets || []).filter(a => a.id && a.url);
  const devices = (state.catalog.devices || []).map(d => ({
    deviceType: d.deviceType,
    name: d.name || undefined,
    models: (d.models || []).map(m => ({
      model: m.model,
      links: (m.links || [])
        .filter(l => l.assetId)
        .map(l => ({
          label: l.label || undefined,
          assetId: l.assetId,
          role: l.role || undefined,
          sort: l.sort === "" ? undefined : Number(l.sort)
        }))
    })).filter(m => m.model)
  })).filter(d => d.deviceType);

  return { assets, devices };
}

async function loadCatalogToEditor() {
  $("refresh-result").textContent = "加载中...";
  try {
    const res = await api("/admin/api/catalog");
    state.catalog = res.catalog || { assets: [], devices: [] };
    state.versionId = res.versionId || null;
    $("refresh-result").textContent = `已加载 version_id=${state.versionId || "unknown"}`;
    renderAssets();
    renderDevices();
    // datalist for asset ids
    let dl = document.getElementById("asset-ids");
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = "asset-ids";
      document.body.appendChild(dl);
    }
    dl.innerHTML = (state.catalog.assets || []).map(a => `<option value="${a.id}">${a.name || ""}</option>`).join("");
  } catch (e) {
    $("refresh-result").textContent = `加载失败：${e.message}`;
  }
}
async function handleRefresh() {
  $("refresh-result").textContent = "刷新中...";
  try {
    const res = await api("/admin/api/refresh", { method: "POST" });
    $("refresh-result").textContent = `已刷新 KV，version_id=${res.versionId}`;
    if (res.catalog) downloadJson(res.catalog, "catalog.json");
  } catch (e) {
    $("refresh-result").textContent = `刷新失败：${e.message}`;
  }
}

async function handleImport() {
  $("import-result").textContent = "发布中...";
  try {
    const catalog = buildCatalogFromUI();
    const label = $("catalog-label").value.trim() || undefined;
    const res = await api("/admin/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ catalog, label })
    });
    $("import-result").textContent = `发布成功，version_id=${res.versionId} label=${res.label}`;
  } catch (e) {
    $("import-result").textContent = `发布失败：${e.message}`;
  }
}

async function handleGetVersion() {
  $("refresh-result").textContent = "查询中...";
  try {
    const res = await api("/admin/api/version");
    $("refresh-result").textContent = `当前已发布 version_id=${res.versionId || "无"}`;
  } catch (e) {
    $("refresh-result").textContent = `查询失败：${e.message}`;
  }
}

function main() {
  loadSavedToken();
  $("btn-save-token").onclick = saveToken;
  $("btn-refresh").onclick = handleRefresh;
  $("btn-import").onclick = handleImport;
  $("btn-get-version").onclick = handleGetVersion;

  $("btn-load").onclick = loadCatalogToEditor;
  $("btn-add-asset").onclick = () => {
    state.catalog.assets.push({
      id: "",
      category: "desktop",
      subtype: "app",
      type: "direct",
      url: ""
    });
    renderAssets();
  };
  $("btn-add-device").onclick = () => {
    state.catalog.devices.push({
      deviceType: "scanner",
      name: "",
      models: []
    });
    renderDevices();
  };

  loadCatalogToEditor();
}

main();
