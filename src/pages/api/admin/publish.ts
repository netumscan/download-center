import type { APIContext } from "astro";
import { requireAdminAccess } from "../../../lib/access";
import { buildAndPublishManifests } from "../../../lib/manifest";
import { setCacheVersion } from "../../../lib/cache";
import { nowIso } from "../../../lib/util";

function makePublishId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const rnd = Math.random().toString(16).slice(2, 8);
  return `${ts}-${rnd}`;
}

export async function POST(ctx: APIContext) {
  const ident = await requireAdminAccess(ctx, { roles: ["admin"] });

  const body = await ctx.request.json().catch(() => ({}));
  const note = body?.note ? String(body.note) : undefined;

  const publishId = makePublishId();

  await buildAndPublishManifests(ctx, publishId, note, ident.email);

  // Cache version stamp: rm:{ver}:{slug}
  await setCacheVersion(ctx, publishId);

  return new Response(JSON.stringify({ publish_id: publishId, generated_at: nowIso() }), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
