import type { APIContext } from "astro";
import { requireAdminAccess } from "../../../lib/access";
import { getEnv } from "../../../lib/runtime";
import { nowIso, sha256HexBytes } from "../../../lib/util";

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(ctx: APIContext) {
  await requireAdminAccess(ctx, { roles: ["admin", "editor"] });
  const env = getEnv(ctx);

  const contentType = ctx.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response(JSON.stringify({ error: "expected_multipart" }), { status: 400 });
  }

  const form = await ctx.request.formData();
  const resourceId = form.get("resourceId")?.toString();
  const file = form.get("file");

  if (!resourceId) return new Response(JSON.stringify({ error: "missing_resourceId" }), { status: 400 });
  if (!(file instanceof File)) return new Response(JSON.stringify({ error: "missing_file" }), { status: 400 });

  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "file_too_large", max_bytes: MAX_BYTES }), { status: 400 });
  }

  // Load resource row
  const row = await env.DB.prepare("SELECT * FROM file_resources WHERE resource_id=?").bind(resourceId).first<any>();
  if (!row) return new Response(JSON.stringify({ error: "resource_not_found" }), { status: 404 });
  if (row.storage_type !== "R2") return new Response(JSON.stringify({ error: "resource_not_r2" }), { status: 400 });

  // R2 key convention: products/{device}/{category}/{slug}/{filename}
  const filename = file.name || "upload.bin";
  const r2Key = `resources/${row.device_category}/${row.file_category}/${row.slug}/${filename}`;

  const buf = await file.arrayBuffer();
  const sha256 = await sha256HexBytes(buf);

  await env.R2_BUCKET.put(r2Key, buf, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
      cacheControl: "private, max-age=0, no-cache"
    }
  });

  await env.DB.prepare(
    "UPDATE file_resources SET r2_bucket=?, r2_key=?, content_type=?, file_size_bytes=?, sha256=?, updated_at=? WHERE id=?"
  ).bind(
    "R2_BUCKET",
    r2Key,
    file.type || "application/octet-stream",
    file.size,
    sha256,
    nowIso(),
    row.id
  ).run();

  return new Response(JSON.stringify({
    ok: true,
    resource_id: row.resource_id,
    slug: row.slug,
    r2_key: r2Key,
    file_size_bytes: file.size,
    content_type: file.type || "application/octet-stream",
    sha256
  }), { headers: { "content-type": "application/json; charset=utf-8" } });
}
