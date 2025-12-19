import type { APIContext } from "astro";
import { r2GetJson } from "../../../lib/r2";

export async function GET(ctx: APIContext) {
  const q = (new URL(ctx.request.url)).searchParams.get("q")?.trim().toLowerCase() || "";
  const data = await r2GetJson<any>(ctx, "public/manifest-search.json");
  if (!data) return new Response(JSON.stringify({ error: "manifest_missing" }), { status: 503 });

  if (!q) return new Response(JSON.stringify({ products: [], software: [], resources: [] }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });

  const hit = (item: any) => (item.keywords || []).some((k: string) => String(k).toLowerCase().includes(q));

  const products = (data.index.products || []).filter(hit).slice(0, 20);
  const software = (data.index.software || []).filter(hit).slice(0, 20);
  const resources = (data.index.resources || []).filter(hit).slice(0, 20);

  return new Response(JSON.stringify({ products, software, resources }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" }
  });
}
