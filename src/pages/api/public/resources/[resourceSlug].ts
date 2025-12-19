import type { APIContext } from "astro";
import { r2GetJson } from "../../../../lib/r2";

export async function GET(ctx: APIContext) {
  const slug = ctx.params.resourceSlug!;
  const data = await r2GetJson<any>(ctx, `public/resource/${slug}.json`);
  if (!data) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" }
  });
}
