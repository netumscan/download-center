import type { APIContext } from "astro";
import { getEnv } from "./runtime";
import { jitterSeconds } from "./util";

export async function getCacheVersion(ctx: APIContext, key = "cache_ver:rm"): Promise<string> {
  const env = getEnv(ctx);
  const v = await env.KV_CACHE.get(key);
  return v || "0";
}

export async function setCacheVersion(ctx: APIContext, version: string, key = "cache_ver:rm"): Promise<void> {
  const env = getEnv(ctx);
  await env.KV_CACHE.put(key, version);
}

export function rmKey(version: string, slug: string): string {
  return `rm:${version}:${slug}`;
}

export async function kvGetJson<T>(ctx: APIContext, key: string): Promise<T | null> {
  const env = getEnv(ctx);
  const v = await env.KV_CACHE.get(key, "json");
  return (v as T) ?? null;
}

export async function kvPutJson(ctx: APIContext, key: string, value: any, ttlSeconds: number): Promise<void> {
  const env = getEnv(ctx);
  await env.KV_CACHE.put(key, JSON.stringify(value), {
    expirationTtl: ttlSeconds
  });
}

export function defaultRmTtlSeconds(): number {
  // 10 minutes + jitter up to 5 minutes
  return jitterSeconds(600, 300);
}
