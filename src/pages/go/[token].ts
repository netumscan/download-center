import type { APIContext } from "astro";
import { getEnv, getExecCtx } from "../../lib/runtime";
import { sha256Hex, parseCsvList } from "../../lib/util";
import { insertDownloadAudit } from "../../lib/audit";

function hostFromUrl(u: string): string | null {
  try { return new URL(u).host.toLowerCase(); } catch { return null; }
}

export async function GET(ctx: APIContext) {
  const env = getEnv(ctx);
  const exec = getExecCtx(ctx);
  const token = ctx.params.token!;
  const tokenHash = await sha256Hex(token);

  // Atomically mark token used (single-use)
  const upd = await env.DB.prepare(
    `UPDATE download_tokens
     SET used_count = used_count + 1
     WHERE token_hash = ?
       AND expires_at > datetime('now')
       AND used_count < max_uses`
  ).bind(tokenHash).run();

  // @ts-expect-error d1 result
  const changes = upd?.meta?.changes ?? 0;
  if (changes !== 1) {
    exec.waitUntil(insertDownloadAudit(ctx, { resourceId: null, resourceSlug: "unknown", storageType: "EXTERNAL", outcome: "EXPIRED" }));
    return new Response("Expired", { status: 410 });
  }

  // Resolve resource + external url
  const row = await env.DB.prepare(
    `SELECT r.id as rid, r.slug as rslug, r.external_url as external_url
     FROM download_tokens t
     JOIN file_resources r ON r.id = t.resource_id
     WHERE t.token_hash = ?`
  ).bind(tokenHash).first<any>();

  if (!row?.external_url) {
    exec.waitUntil(insertDownloadAudit(ctx, { resourceId: row?.rid ?? null, resourceSlug: row?.rslug ?? "unknown", storageType: "EXTERNAL", outcome: "ERROR" }));
    return new Response("Misconfigured", { status: 500 });
  }

  const host = hostFromUrl(row.external_url);
  const allow = new Set(parseCsvList(env.EXTERNAL_ALLOWLIST).map((h) => h.toLowerCase()));
  if (!host || !allow.has(host)) {
    exec.waitUntil(insertDownloadAudit(ctx, { resourceId: row.rid, resourceSlug: row.rslug, storageType: "EXTERNAL", outcome: "DENY" }));
    return new Response("Denied", { status: 403 });
  }

  exec.waitUntil(insertDownloadAudit(ctx, { resourceId: row.rid, resourceSlug: row.rslug, storageType: "EXTERNAL", outcome: "REDIRECT_OK" }));
  return Response.redirect(row.external_url, 302);
}
