import type { APIContext } from "astro";
import { getEnv } from "../../lib/runtime";
import { getCacheVersion, rmKey, kvGetJson, kvPutJson, defaultRmTtlSeconds } from "../../lib/cache";
import { insertDownloadAudit } from "../../lib/audit";
import { getExecCtx } from "../../lib/runtime";
import { randomTokenBase64Url, sha256Hex, safeFilename, nowIso, parseCsvList } from "../../lib/util";
import { parseRange } from "../../lib/download-logic";

type RmCache = {
  id: number;
  slug: string;
  storage_type: "R2" | "EXTERNAL";
  r2_key?: string | null;
  content_type?: string | null;
  file_size_bytes?: number | null;
  sha256?: string | null;
  updated_at?: string | null;
};

export async function GET(ctx: APIContext) {
  const env = getEnv(ctx);
  const exec = getExecCtx(ctx);
  const slug = ctx.params.resourceSlug!;
  const ver = await getCacheVersion(ctx);
  const key = rmKey(ver, slug);

  let meta = await kvGetJson<RmCache>(ctx, key);
  if (!meta) {
    const row = await env.DB.prepare(
      `SELECT id, slug, storage_type, r2_key, content_type, file_size_bytes, sha256, updated_at
       FROM file_resources WHERE slug=? AND is_published=1`
    ).bind(slug).first<any>();

    if (!row) {
      exec.waitUntil(insertDownloadAudit(ctx, { resourceId: null, resourceSlug: slug, storageType: null, outcome: "NOT_FOUND" }));
      return new Response("Not Found", { status: 404 });
    }
    meta = row as RmCache;
    await kvPutJson(ctx, key, meta, defaultRmTtlSeconds());
  }

  if (meta.storage_type === "R2") {
    if (!meta.r2_key) {
      exec.waitUntil(insertDownloadAudit(ctx, { resourceId: meta.id, resourceSlug: slug, storageType: "R2", outcome: "ERROR" }));
      return new Response("Misconfigured resource", { status: 500 });
    }

    const obj = await env.R2_BUCKET.get(meta.r2_key);
    if (!obj) {
      exec.waitUntil(insertDownloadAudit(ctx, { resourceId: meta.id, resourceSlug: slug, storageType: "R2", outcome: "NOT_FOUND" }));
      return new Response("Not Found", { status: 404 });
    }

    const size = obj.size;
    const range = parseRange(ctx.request.headers.get("range"), size);

    const filename = safeFilename(`${slug}`);
    const headers = new Headers();
    headers.set("content-type", meta.content_type || "application/octet-stream");
    headers.set("content-disposition", `attachment; filename="${filename}"`);
    headers.set("accept-ranges", "bytes");

    if (range) {
      const offset = range.start;
      const length = range.end - range.start + 1;
      const part = await env.R2_BUCKET.get(meta.r2_key, { range: { offset, length } });
      if (!part) {
        exec.waitUntil(insertDownloadAudit(ctx, { resourceId: meta.id, resourceSlug: slug, storageType: "R2", outcome: "ERROR" }));
        return new Response("Range error", { status: 416 });
      }
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("content-length", String(length));
      exec.waitUntil(insertDownloadAudit(ctx, { resourceId: meta.id, resourceSlug: slug, storageType: "R2", outcome: "OK", bytesSent: length }));
      return new Response(part.body, { status: 206, headers });
    } else {
      headers.set("content-length", String(size));
      exec.waitUntil(insertDownloadAudit(ctx, { resourceId: meta.id, resourceSlug: slug, storageType: "R2", outcome: "OK", bytesSent: size }));
      return new Response(obj.body, { status: 200, headers });
    }
  }

  // EXTERNAL: generate short token and redirect to /go/:token
  const token = randomTokenBase64Url(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  await env.DB.prepare(
    `INSERT INTO download_tokens (resource_id, token_hash, expires_at, max_uses, used_count, created_by_email, created_at)
     VALUES (?, ?, ?, 1, 0, NULL, ?)`
  ).bind(meta.id, tokenHash, expiresAt, nowIso()).run();

  exec.waitUntil(insertDownloadAudit(ctx, { resourceId: meta.id, resourceSlug: slug, storageType: "EXTERNAL", outcome: "OK" }));
  return Response.redirect(new URL(`/go/${token}`, ctx.request.url).toString(), 302);
}
