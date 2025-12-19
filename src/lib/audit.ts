import type { APIContext } from "astro";
import { d1One } from "./db";
import { nowIso, getClientIp } from "./util";
import { getEnv } from "./runtime";
import { getAccessIdentity } from "./access";

export type AuditOutcome =
  | "OK"
  | "NOT_FOUND"
  | "DENY"
  | "EXPIRED"
  | "ERROR"
  | "REDIRECT_OK"
  | "LOG_FAILED";

export async function insertDownloadAudit(
  ctx: APIContext,
  params: {
    resourceId?: number | null;
    resourceSlug: string;
    storageType?: string | null;
    outcome: AuditOutcome;
    bytesSent?: number | null;
  }
): Promise<void> {
  const env = getEnv(ctx);
  const req = ctx.request;
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  const referer = req.headers.get("referer");
  // @ts-expect-error cloudflare request cf
  const cf = (req as any).cf || {};
  const country = cf.country || null;
  const colo = cf.colo || null;

  const ident = getAccessIdentity(req);

  const stmt = env.DB.prepare(
    `INSERT INTO download_audit
      (resource_id, resource_slug, storage_type, outcome, ip, user_agent, referer, country, colo, access_email, access_sub, bytes_sent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    params.resourceId ?? null,
    params.resourceSlug,
    params.storageType ?? null,
    params.outcome,
    ip,
    ua,
    referer,
    country,
    colo,
    ident.email ?? null,
    ident.sub ?? null,
    params.bytesSent ?? null,
    nowIso()
  );

  await stmt.run();
}
