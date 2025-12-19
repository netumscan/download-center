async function loadCatalog(request, env) {
  const url = new URL(request.url);
  const req = new Request(new URL("/catalog.json", url.origin), request);
  const res = await env.ASSETS.fetch(req);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API: return catalog JSON (public)
    if (request.method === "GET" && path === "/api/catalog") {
      const catalog = await loadCatalog(request, env);
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

      const catalog = await loadCatalog(request, env);
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
