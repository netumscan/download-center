const $ = id => document.getElementById(id);
const TOKEN_KEY = "admin_token";

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

async function handleRefresh() {
  $("refresh-result").textContent = "刷新中...";
  try {
    const res = await api("/admin/api/refresh", { method: "POST" });
    $("refresh-result").textContent = `已刷新 KV，version_id=${res.versionId}`;
    if (res.catalog) {
      downloadJson(res.catalog, "catalog.json");
    }
  } catch (e) {
    $("refresh-result").textContent = `刷新失败：${e.message}`;
  }
}

async function handleImport() {
  $("import-result").textContent = "发布中...";
  try {
    const raw = $("catalog-json").value.trim();
    if (!raw) throw new Error("请粘贴 catalog JSON");
    const catalog = JSON.parse(raw);
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
}

main();
