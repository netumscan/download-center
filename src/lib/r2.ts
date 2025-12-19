import type { APIContext } from "astro";
import { getEnv } from "./runtime";

export async function r2GetText(ctx: APIContext, key: string): Promise<string | null> {
  const env = getEnv(ctx);
  const obj = await env.R2_BUCKET.get(key);
  if (!obj) return null;
  return await obj.text();
}

export async function r2GetJson<T>(ctx: APIContext, key: string): Promise<T | null> {
  const t = await r2GetText(ctx, key);
  if (!t) return null;
  return JSON.parse(t) as T;
}

export async function r2PutJson(ctx: APIContext, key: string, value: any, opts?: { cacheControl?: string }): Promise<void> {
  const env = getEnv(ctx);
  const body = JSON.stringify(value, null, 2);
  await env.R2_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: "application/json",
      cacheControl: opts?.cacheControl
    }
  });
}
