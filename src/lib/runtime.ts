import type { APIContext } from "astro";

export function getEnv(ctx: APIContext) {
  if (!ctx.locals?.runtime?.env) throw new Error("Missing runtime env. Ensure Cloudflare adapter is configured.");
  return ctx.locals.runtime.env;
}

export function getExecCtx(ctx: APIContext) {
  if (!ctx.locals?.runtime?.ctx) throw new Error("Missing execution context.");
  return ctx.locals.runtime.ctx;
}
