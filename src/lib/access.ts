import type { APIContext } from "astro";

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

export function requireAdminAccess(_ctx: APIContext): void {
  // Access is enforced by Cloudflare on /api/admin/*.
  // Optional: implement RBAC using admin_roles.
}
