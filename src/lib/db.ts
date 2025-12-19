import type { APIContext } from "astro";
import { getEnv } from "./runtime";

export function db(ctx: APIContext): D1Database {
  return getEnv(ctx).DB;
}

export async function d1One<T>(stmt: D1PreparedStatement): Promise<T | null> {
  const res = await stmt.first<T>();
  return res ?? null;
}

export async function d1All<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const res = await stmt.all<T>();
  // @ts-expect-error workers types
  return (res.results ?? []) as T[];
}
