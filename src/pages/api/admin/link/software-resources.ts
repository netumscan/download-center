import type { APIContext } from "astro";
import { requireAdminAccess } from "../../../../lib/access";
import { getEnv } from "../../../../lib/runtime";

export async function POST(ctx: APIContext) {
  requireAdminAccess(ctx);
  const env = getEnv(ctx);
  const b = await ctx.request.json();
  const { software_id, resource_id, sort_order = 0 } = b || {};
  if (!software_id || !resource_id) return new Response(JSON.stringify({ error: "missing_ids" }), { status: 400 });

  await env.DB.prepare(
    "INSERT OR REPLACE INTO software_resources (software_id, resource_id, sort_order) VALUES (?, ?, ?)"
  ).bind(software_id, resource_id, sort_order).run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json; charset=utf-8" } });
}
