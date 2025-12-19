import type { APIContext } from "astro";
import { requireAdminAccess } from "../../../../lib/access";
import { getEnv } from "../../../../lib/runtime";

export async function POST(ctx: APIContext) {
  requireAdminAccess(ctx);
  const env = getEnv(ctx);
  const b = await ctx.request.json();
  const { product_id, software_id, sort_order = 0 } = b || {};
  if (!product_id || !software_id) return new Response(JSON.stringify({ error: "missing_ids" }), { status: 400 });

  await env.DB.prepare(
    "INSERT OR REPLACE INTO product_software (product_id, software_id, sort_order) VALUES (?, ?, ?)"
  ).bind(product_id, software_id, sort_order).run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json; charset=utf-8" } });
}
