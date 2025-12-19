import type { APIContext } from "astro";
import { r2GetJson } from "../../../lib/r2";

export async function GET(ctx: APIContext) {
  const data = await r2GetJson<any>(ctx, "public/manifest-search.json");
  if (!data) {
    return new Response(JSON.stringify({ error: "manifest_missing" }), { status: 503 });
  }

  const software = Array.isArray(data.index?.software) ? data.index.software : [];

  return new Response(JSON.stringify({ software }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" }
  });
}
