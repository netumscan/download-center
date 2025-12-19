const CACHE_TTL = 300;
const VERSION_CACHE_KEY = "version:latest";
const CATALOG_CACHE_PREFIX = "catalog:";
const ASSET_CACHE_PREFIX = "asset:";

const ensureArray = value => (Array.isArray(value) ? value : []);
const toSafeNumber = value => (typeof value === "number" ? value : undefined);

function catalogCacheKey(versionId) {
  return `${CATALOG_CACHE_PREFIX}${versionId ?? "static"}`;
}

function assetCacheKey(versionId, assetId) {
  return `${ASSET_CACHE_PREFIX}${versionId ?? "static"}:${assetId}`;
}

async function getPublishedVersionId(env, ctx) {
  if (!env?.DB) return null;

  if (env.CACHE) {
    const cached = await env.CACHE.get(VERSION_CACHE_KEY);
    if (cached) return cached;
  }

  try {
    const { results } = await env.DB.prepare(
      "SELECT version_id FROM catalog_versions WHERE status = 'published' ORDER BY published_at DESC, version_id DESC LIMIT 1"
    ).all();
    const versionId = results?.[0]?.version_id ?? null;
    if (versionId && env.CACHE) {
      ctx?.waitUntil(env.CACHE.put(VERSION_CACHE_KEY, versionId, { expirationTtl: 60 }));
    }
    return versionId;
  } catch (err) {
    console.error("getPublishedVersionId error", err);
    return null;
  }
}

async function readCatalogFromKV(env, versionId) {
  if (!env?.CACHE) return null;
  const cached = await env.CACHE.get(catalogCacheKey(versionId));
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

async function writeCatalogToKV(env, catalog, versionId, ctx) {
  if (!env?.CACHE || !catalog) return;
  const payload = JSON.stringify(catalog);
  ctx?.waitUntil(env.CACHE.put(catalogCacheKey(versionId), payload, { expirationTtl: CACHE_TTL }));
}

async function cacheAssetMappings(env, catalog, versionId, ctx) {
  if (!env?.CACHE || !catalog?.assets) return;
  const puts = catalog.assets
    .filter(item => item?.id && item?.url)
    .map(item => env.CACHE.put(assetCacheKey(versionId, item.id), item.url, { expirationTtl: CACHE_TTL }));
  if (puts.length) {
    ctx?.waitUntil(Promise.allSettled(puts));
  }
}

async function writeVersionToKV(env, versionId, ctx) {
  if (!env?.CACHE || !versionId) return;
  ctx?.waitUntil(env.CACHE.put(VERSION_CACHE_KEY, versionId, { expirationTtl: 60 }));
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function requireAdminAuth(request, env) {
  const token = env?.ADMIN_TOKEN;
  if (!token) return false;
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${token}`;
  return header === expected;
}

async function ensureSchema(env) {
  if (!env?.DB) return false;
  const ddl = `
    CREATE TABLE IF NOT EXISTS catalog_versions (
      version_id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT,
      status TEXT CHECK(status IN ('draft','published')) NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      published_at TEXT,
      author TEXT,
      notes TEXT,
      payload TEXT
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT,
      version_id INTEGER NOT NULL,
      category TEXT,
      subtype TEXT,
      name TEXT,
      type TEXT,
      url TEXT,
      platform TEXT,
      arch TEXT,
      format TEXT,
      version TEXT,
      release_date TEXT,
      sha256 TEXT,
      size INTEGER,
      created_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (id, version_id),
      FOREIGN KEY (version_id) REFERENCES catalog_versions(version_id)
    );
    CREATE TABLE IF NOT EXISTS devices (
      device_id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      device_type TEXT,
      name TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (version_id) REFERENCES catalog_versions(version_id)
    );
    CREATE TABLE IF NOT EXISTS device_models (
      model_id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      device_id INTEGER NOT NULL,
      model TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (version_id) REFERENCES catalog_versions(version_id),
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS model_links (
      link_id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      model_id INTEGER NOT NULL,
      asset_id TEXT NOT NULL,
      label TEXT,
      role TEXT,
      sort INTEGER,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (version_id) REFERENCES catalog_versions(version_id),
      FOREIGN KEY (model_id) REFERENCES device_models(model_id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id, version_id) REFERENCES assets(id, version_id)
    );
  `;
  await env.DB.exec(ddl);
  return true;
}

async function importCatalogToD1(env, catalog, label) {
  if (!env?.DB || !catalog) throw new Error("D1 not configured");
  await ensureSchema(env);

  const now = new Date().toISOString();
  const versionLabel = label || `manual-${now}`;
  const payload = JSON.stringify(catalog);

  const versionRes = await env.DB.prepare(
    "INSERT INTO catalog_versions (label, status, created_at, published_at, payload) VALUES (?, 'published', ?, ?, ?)"
  ).bind(versionLabel, now, now, payload).run();

  const versionId = versionRes?.meta?.last_row_id;
  if (!versionId) throw new Error("failed to create version");

  const assets = ensureArray(catalog.assets);
  for (const a of assets) {
    await env.DB.prepare(
      `INSERT INTO assets (id, version_id, category, subtype, name, type, url, platform, arch, format, version, release_date, sha256, size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      a.id, versionId, a.category, a.subtype, a.name, a.type, a.url,
      a.platform, a.arch, a.format, a.version, a.releaseDate, a.sha256,
      toSafeNumber(a.size), now, now
    ).run();
  }

  const devices = ensureArray(catalog.devices);
  for (const d of devices) {
    const deviceRes = await env.DB.prepare(
      "INSERT INTO devices (version_id, device_type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(versionId, d.deviceType, d.name, now, now).run();
    const deviceId = deviceRes?.meta?.last_row_id;
    if (!deviceId) continue;

    const models = ensureArray(d.models);
    for (const m of models) {
      const modelRes = await env.DB.prepare(
        "INSERT INTO device_models (version_id, device_id, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(versionId, deviceId, m.model, now, now).run();
      const modelId = modelRes?.meta?.last_row_id;
      if (!modelId) continue;

      const links = ensureArray(m.links);
      for (const l of links) {
        await env.DB.prepare(
          "INSERT INTO model_links (version_id, model_id, asset_id, label, role, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          versionId, modelId, l.assetId, l.label, l.role, toSafeNumber(l.sort), now, now
        ).run();
      }
    }
  }

  return { versionId, label: versionLabel };
}

async function loadCatalogFromStatic(request, env) {
  const url = new URL(request.url);
  const req = new Request(new URL("/catalog.json", url.origin), request);
  const res = await env.ASSETS.fetch(req);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

async function loadCatalogFromD1(env, versionId) {
  if (!env?.DB || !versionId) return null;

  try {
    const assetRows = await env.DB.prepare(
      `SELECT id, category, subtype, name, type, url, platform, arch, format, version, release_date, sha256, size
       FROM assets WHERE version_id = ?`
    ).all(versionId);

    const devices = await env.DB.prepare(
      `SELECT device_id, device_type, name
       FROM devices
       WHERE version_id = ?
       ORDER BY device_id`
    ).all(versionId);

    const models = await env.DB.prepare(
      `SELECT model_id, device_id, model
       FROM device_models
       WHERE version_id = ?
       ORDER BY model_id`
    ).all(versionId);

    const links = await env.DB.prepare(
      `SELECT link_id, model_id, asset_id, label, role, sort
       FROM model_links
       WHERE version_id = ?
       ORDER BY COALESCE(sort, 0), link_id`
    ).all(versionId);

    const assets = ensureArray(assetRows.results).map(row => ({
      id: row.id,
      category: row.category,
      subtype: row.subtype,
      name: row.name,
      type: row.type,
      url: row.url,
      platform: row.platform ?? undefined,
      arch: row.arch ?? undefined,
      format: row.format ?? undefined,
      version: row.version ?? undefined,
      releaseDate: row.release_date ?? undefined,
      sha256: row.sha256 ?? undefined,
      size: toSafeNumber(row.size)
    }));

    const modelMap = new Map();
    ensureArray(models.results).forEach(row => {
      modelMap.set(row.model_id, {
        model: row.model,
        links: []
      });
    });

    ensureArray(links.results).forEach(row => {
      const entry = modelMap.get(row.model_id);
      if (!entry) return;
      entry.links.push({
        assetId: row.asset_id,
        label: row.label,
        role: row.role,
        sort: toSafeNumber(row.sort)
      });
    });

    const deviceMap = new Map();
    ensureArray(devices.results).forEach(row => {
      deviceMap.set(row.device_id, {
        deviceType: row.device_type,
        name: row.name ?? undefined,
        models: []
      });
    });

    ensureArray(models.results).forEach(row => {
      const device = deviceMap.get(row.device_id);
      if (!device) return;
      const model = modelMap.get(row.model_id);
      device.models.push({
        model: row.model,
        links: model ? model.links : []
      });
    });

    const devicesPayload = Array.from(deviceMap.values());
    return { assets, devices: devicesPayload };
  } catch (err) {
    console.error("loadCatalogFromD1 error", err);
    return null;
  }
}

async function loadCatalog(request, env, ctx, versionHint) {
  const versionId = versionHint ?? (await getPublishedVersionId(env, ctx));
  const cached = await readCatalogFromKV(env, versionId);
  if (cached) return cached;

  const catalogFromD1 = await loadCatalogFromD1(env, versionId);
  if (catalogFromD1) {
    await writeCatalogToKV(env, catalogFromD1, versionId, ctx);
    await cacheAssetMappings(env, catalogFromD1, versionId, ctx);
    return catalogFromD1;
  }

  const catalogFromStatic = await loadCatalogFromStatic(request, env);
  if (!catalogFromStatic) return null;

  await writeCatalogToKV(env, catalogFromStatic, versionId, ctx);
  await cacheAssetMappings(env, catalogFromStatic, versionId, ctx);
  return catalogFromStatic;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Admin APIs (token required)
    if (path.startsWith("/admin/api/")) {
      if (!requireAdminAuth(request, env)) return unauthorized();

      // current published version
      if (request.method === "GET" && path === "/admin/api/version") {
        const versionId = await getPublishedVersionId(env, ctx);
        return new Response(JSON.stringify({ versionId }), {
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      }

      // refresh: read D1 and write KV, return catalog for download
      if (request.method === "POST" && path === "/admin/api/refresh") {
        const body = await request.json().catch(() => ({}));
        const versionHint = body?.versionId || url.searchParams.get("versionId");
        const versionId = versionHint || (await getPublishedVersionId(env, ctx));

        const catalog =
          (await loadCatalogFromD1(env, versionId)) ||
          (await loadCatalogFromStatic(request, env));

        if (!catalog) return new Response("catalog not found", { status: 500 });

        await writeCatalogToKV(env, catalog, versionId, ctx);
        await cacheAssetMappings(env, catalog, versionId, ctx);
        await writeVersionToKV(env, versionId, ctx);

        return new Response(JSON.stringify({ ok: true, versionId, catalog }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": "attachment; filename=catalog.json"
          }
        });
      }

      // import new catalog into D1 and publish immediately
      if (request.method === "POST" && path === "/admin/api/import") {
        const body = await request.json().catch(() => null);
        const catalog = body?.catalog || body;
        const label = body?.label;
        if (!catalog || !Array.isArray(catalog.assets)) {
          return new Response("invalid catalog", { status: 400 });
        }

        try {
          const result = await importCatalogToD1(env, catalog, label);
          await writeCatalogToKV(env, catalog, result.versionId, ctx);
          await cacheAssetMappings(env, catalog, result.versionId, ctx);
          await writeVersionToKV(env, result.versionId, ctx);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json; charset=utf-8" }
          });
        } catch (err) {
          console.error("importCatalogToD1 failed", err);
          return new Response("import failed", { status: 500 });
        }
      }

      return new Response("Not Found", { status: 404 });
    }

    // API: return catalog JSON (public)
    if (request.method === "GET" && path === "/api/catalog") {
      const versionId = await getPublishedVersionId(env);
      const catalog = await loadCatalog(request, env, ctx, versionId);
      if (!catalog) return new Response("catalog not found", { status: 500 });

      return new Response(JSON.stringify(catalog), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60"
        }
      });
    }

    // Download redirect: /d/<assetId>
    if (request.method === "GET" && path.startsWith("/d/")) {
      const assetId = decodeURIComponent(path.slice(3));
      if (!assetId) return new Response("Bad Request", { status: 400 });

      const versionId = await getPublishedVersionId(env);
      if (env?.CACHE) {
        const cachedUrl = await env.CACHE.get(assetCacheKey(versionId, assetId));
        if (cachedUrl) {
          return Response.redirect(cachedUrl, 302);
        }
      }

      const catalog = await loadCatalog(request, env, ctx, versionId);
      if (!catalog || !Array.isArray(catalog.assets)) {
        return new Response("catalog not found", { status: 500 });
      }

      const item = catalog.assets.find(x => x && x.id === assetId);
      if (!item) return new Response("Not Found", { status: 404 });
      if (!item.url) return new Response("Invalid asset url", { status: 500 });

      return Response.redirect(item.url, 302);
    }

    // Static assets
    return env.ASSETS.fetch(request);
  }
};
