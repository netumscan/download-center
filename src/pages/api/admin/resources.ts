import type { APIContext } from "astro";
import { requireAdminAccess } from "../../../lib/access";
import { getEnv } from "../../../lib/runtime";
import { nowIso } from "../../../lib/util";

export async function POST(ctx: APIContext) {
  requireAdminAccess(ctx);
  const env = getEnv(ctx);
  const b = await ctx.request.json();

  // Minimal validation (extend as needed)
  const required = ["resource_id","slug","title","device_category","file_category","storage_type"];
  for (const k of required) {
    if (!b?.[k]) return new Response(JSON.stringify({ error: "missing_field", field: k }), { status: 400 });
  }

  if (b.storage_type === "EXTERNAL") {
    if (!b.external_url) return new Response(JSON.stringify({ error: "missing_external_url" }), { status: 400 });
    const url = new URL(String(b.external_url));
    if (url.protocol !== "https:") return new Response(JSON.stringify({ error: "external_url_must_be_https" }), { status: 400 });
  }

  const stmt = env.DB.prepare(
    `INSERT INTO file_resources
      (resource_id, slug, title, device_category, file_category, file_size_bytes, sha256, platform, arch, version, release_notes,
       storage_type, r2_bucket, r2_key, content_type, external_url, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    String(b.resource_id),
    String(b.slug),
    String(b.title),
    String(b.device_category),
    String(b.file_category),
    b.file_size_bytes ?? null,
    b.sha256 ?? null,
    b.platform ?? null,
    b.arch ?? null,
    b.version ?? null,
    b.release_notes ?? null,
    String(b.storage_type),
    b.r2_bucket ?? null,
    b.r2_key ?? null,
    b.content_type ?? null,
    b.external_url ?? null,
    b.is_published ? 1 : 0,
    nowIso(),
    nowIso()
  );

  const r = await stmt.run();
  return new Response(JSON.stringify({ ok: true, result: r }), { headers: { "content-type": "application/json; charset=utf-8" } });
}

export async function PATCH(ctx: APIContext) {
  requireAdminAccess(ctx);
  const env = getEnv(ctx);
  const b = await ctx.request.json();
  const id = Number(b?.id);
  if (!id) return new Response(JSON.stringify({ error: "missing_id" }), { status: 400 });

  // Update a subset; extend as needed
  const fields = ["title","remark","release_notes","is_published","file_size_bytes","sha256","platform","arch","version","content_type","external_url"];
  const sets: string[] = [];
  const values: any[] = [];
  for (const f of fields) {
    if (b[f] !== undefined) {
      sets.push(`${f}=?`);
      values.push(b[f]);
    }
  }
  sets.push("updated_at=?");
  values.push(nowIso());
  values.push(id);

  const sql = `UPDATE file_resources SET ${sets.join(", ")} WHERE id=?`;
  await env.DB.prepare(sql).bind(...values).run();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json; charset=utf-8" } });
}
