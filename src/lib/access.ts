import type { APIContext } from "astro";
import { getEnv } from "./runtime";

export type AccessIdentity = {
  email?: string;
  sub?: string;
};

export function getAccessJwt(request: Request): string | null {
  return request.headers.get("Cf-Access-Jwt-Assertion");
}

/**
 * Minimal identity extraction.
 * - If you need strict verification, validate JWT signature against Cloudflare Access JWKS.
 * - For audit and role checks, the email/sub are typically sufficient when Access is already enforcing path protection.
 */
export function getAccessIdentity(request: Request): AccessIdentity {
  const jwt = getAccessJwt(request);
  if (!jwt) return {};
  // Decode JWT payload without verification (best effort).
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return {};
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { email: payload.email, sub: payload.sub };
  } catch {
    return {};
  }
}

export async function requireAdminAccess(ctx: APIContext, opts?: { roles?: string[] }): Promise<AccessIdentity> {
  const ident = getAccessIdentity(ctx.request);
  if (!ident.email) {
    throw new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const roles = opts?.roles ?? [];
  if (roles.length === 0) return ident;

  const env = getEnv(ctx);
  const row = await env.DB.prepare("SELECT role FROM admin_roles WHERE email=?").bind(ident.email).first<any>();
  const role = row?.role;
  if (!role || !roles.includes(role)) {
    throw new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  return ident;
}
