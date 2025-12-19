import type { APIContext } from "astro";
import { requireAdminAccess } from "../../../lib/access";
import { getEnv } from "../../../lib/runtime";
import { nowIso, parseCsvList } from "../../../lib/util";

const ALLOWED_DEVICE: DeviceCategory[] = ["scanner", "document_camera", "printer", "other"];
const ALLOWED_FILE: FileCategory[] = ["desktop_software", "mobile_software", "product_specs", "user_manual", "firmware"];
const ALLOWED_STORAGE: StorageType[] = ["R2", "EXTERNAL"];

function jsonError(error: string, status = 400, extra: Record<string, any> = {}) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function validateSlug(slug: any): slug is string {
  return typeof slug === "string" && !!slug && /^[a-zA-Z0-9._-]+$/.test(slug);
}

function validateExternalUrl(env: Env, urlStr: any) {
  if (!urlStr) return { ok: false, error: "missing_external_url" };
  let url: URL;
  try {
    url = new URL(String(urlStr));
  } catch {
    return { ok: false, error: "invalid_external_url" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "external_url_must_be_https" };
  }

  const allow = new Set(parseCsvList(env.EXTERNAL_ALLOWLIST).map((h) => h.toLowerCase()));
  const host = url.host.toLowerCase();
  if (allow.size === 0 || !allow.has(host)) {
    return { ok: false, error: "external_host_not_allowed", host };
  }
  return { ok: true, url };
}

export async function POST(ctx: APIContext) {
  await requireAdminAccess(ctx, { roles: ["admin", "editor"] });
  const env = getEnv(ctx);
  const b = await ctx.request.json().catch(() => ({} as Record<string, any>));

  const required = ["resource_id", "slug", "title", "device_category", "file_category", "storage_type"];
  for (const k of required) {
    if (!b?.[k]) return jsonError("missing_field", 400, { field: k });
  }
  if (!validateSlug(b.slug)) return jsonError("invalid_slug");
  if (!ALLOWED_DEVICE.includes(b.device_category)) return jsonError("invalid_device_category");
  if (!ALLOWED_FILE.includes(b.file_category)) return jsonError("invalid_file_category");
  if (!ALLOWED_STORAGE.includes(b.storage_type)) return jsonError("invalid_storage_type");

  if (b.storage_type === "EXTERNAL") {
    const v = validateExternalUrl(env, b.external_url);
    if (!v.ok) return jsonError(v.error, 400, "host" in v ? { host: v.host } : undefined);
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
  await requireAdminAccess(ctx, { roles: ["admin", "editor"] });
  const env = getEnv(ctx);
  const b = await ctx.request.json().catch(() => ({} as Record<string, any>));
  const id = Number(b?.id);
  if (!id) return jsonError("missing_id");

  if (b.external_url !== undefined) {
    const v = validateExternalUrl(env, b.external_url);
    if (!v.ok) return jsonError(v.error, 400, "host" in v ? { host: v.host } : undefined);
  }

  const fields = ["title", "remark", "release_notes", "is_published", "file_size_bytes", "sha256", "platform", "arch", "version", "content_type", "external_url"];
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
