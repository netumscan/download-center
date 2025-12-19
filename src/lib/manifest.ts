import type { APIContext } from "astro";
import { getEnv } from "./runtime";
import { d1All, d1One } from "./db";
import { nowIso } from "./util";
import { r2PutJson } from "./r2";

type ProductSeriesRow = any;
type ProductRow = any;
type SoftwareRow = any;
type ResourceRow = any;

function publicResource(r: any) {
  return {
    resource_id: r.resource_id,
    slug: r.slug,
    title: r.title,
    file_category: r.file_category,
    device_category: r.device_category,
    file_size_bytes: r.file_size_bytes ?? null,
    sha256: r.sha256 ?? null,
    platform: r.platform ?? null,
    arch: r.arch ?? null,
    version: r.version ?? null,
    release_notes: r.release_notes ?? null,
    storage_type: r.storage_type,
    download_url: `/d/${r.slug}`,
    updated_at: r.updated_at
  };
}

function publicSoftware(s: any) {
  return {
    slug: s.slug,
    name: s.name,
    device_category: s.device_category,
    cover_image_url: s.cover_image_url ?? null,
    remark: s.remark ?? null,
    description: s.description ?? null
  };
}

function publicProduct(p: any, series: any | null) {
  return {
    slug: p.slug,
    name: p.name,
    device_category: p.device_category,
    series: series ? { slug: series.slug, name: series.name } : null,
    cover_image_url: p.cover_image_url ?? null,
    remark: p.remark ?? null,
    description: p.description ?? null
  };
}

export async function buildAndPublishManifests(
  ctx: APIContext,
  publishId: string,
  note?: string,
  createdByEmail?: string
): Promise<void> {
  const env = getEnv(ctx);

  // 1) Site settings
  const site = await env.DB.prepare("SELECT * FROM site_settings WHERE id=1").first<any>();

  // 2) Series / products / software / resources
  const series = await d1All<any>(env.DB.prepare(
    "SELECT * FROM product_series WHERE is_published=1 ORDER BY sort_order ASC, id ASC"
  ));
  const products = await d1All<any>(env.DB.prepare(
    "SELECT * FROM products WHERE is_published=1 ORDER BY id ASC"
  ));
  const software = await d1All<any>(env.DB.prepare(
    "SELECT * FROM software WHERE is_published=1 ORDER BY id ASC"
  ));
  const resources = await d1All<any>(env.DB.prepare(
    "SELECT * FROM file_resources WHERE is_published=1 ORDER BY updated_at DESC, id DESC"
  ));

  // Relations
  const productSoftware = await d1All<any>(env.DB.prepare(
    `SELECT ps.product_id, ps.sort_order, s.*
     FROM product_software ps JOIN software s ON s.id=ps.software_id
     WHERE s.is_published=1
     ORDER BY ps.product_id ASC, ps.sort_order ASC`
  ));
  const productResources = await d1All<any>(env.DB.prepare(
    `SELECT pr.product_id, pr.sort_order, r.*
     FROM product_resources pr JOIN file_resources r ON r.id=pr.resource_id
     WHERE r.is_published=1
     ORDER BY pr.product_id ASC, pr.sort_order ASC`
  ));
  const softwareResources = await d1All<any>(env.DB.prepare(
    `SELECT sr.software_id, sr.sort_order, r.*
     FROM software_resources sr JOIN file_resources r ON r.id=sr.resource_id
     WHERE r.is_published=1
     ORDER BY sr.software_id ASC, sr.sort_order ASC`
  ));

  // 3) Build device tree: device -> series -> products
  const seriesById = new Map(series.map((s: any) => [s.id, s]));
  const productsBySeries = new Map<number, any[]>();
  for (const p of products) {
    if (!p.series_id) continue;
    const arr = productsBySeries.get(p.series_id) ?? [];
    arr.push(p);
    productsBySeries.set(p.series_id, arr);
  }

  const devices = ["scanner", "document_camera", "printer", "other"].map((dc) => {
    const sers = series
      .filter((s: any) => s.device_category === dc)
      .map((s: any) => ({
        slug: s.slug,
        name: s.name,
        cover_image_url: s.cover_image_url ?? null,
        description: s.description ?? null,
        products: (productsBySeries.get(s.id) ?? []).map((p: any) => ({
          slug: p.slug,
          name: p.name,
          cover_image_url: p.cover_image_url ?? null,
          remark: p.remark ?? null
        }))
      }));
    return { device_category: dc, series: sers };
  });

  // 4) Build per-product manifests
  const seriesBySlug = new Map(series.map((s: any) => [s.slug, s]));
  const seriesByProductId = new Map<number, any | null>();
  for (const p of products) {
    seriesByProductId.set(p.id, p.series_id ? seriesById.get(p.series_id) ?? null : null);
  }

  const psByProduct = new Map<number, any[]>();
  for (const row of productSoftware) {
    const arr = psByProduct.get(row.product_id) ?? [];
    arr.push(row);
    psByProduct.set(row.product_id, arr);
  }

  const prByProduct = new Map<number, any[]>();
  for (const row of productResources) {
    const arr = prByProduct.get(row.product_id) ?? [];
    arr.push(row);
    prByProduct.set(row.product_id, arr);
  }

  const srBySoftware = new Map<number, any[]>();
  for (const row of softwareResources) {
    const arr = srBySoftware.get(row.software_id) ?? [];
    arr.push(row);
    srBySoftware.set(row.software_id, arr);
  }

  const meta = { publish_id: publishId, generated_at: nowIso() };

  // Home manifest (keep it minimal; you can refine selection rules later)
  const featuredProducts = products.slice(0, 8).map((p: any) => ({
    slug: p.slug,
    name: p.name,
    device_category: p.device_category,
    cover_image_url: p.cover_image_url ?? null,
    remark: p.remark ?? null
  }));
  const featuredSoftware = software.slice(0, 8).map((s: any) => ({
    slug: s.slug,
    name: s.name,
    device_category: s.device_category,
    cover_image_url: s.cover_image_url ?? null,
    remark: s.remark ?? null
  }));
  const recentResources = resources.slice(0, 12).map(publicResource);

  const homeManifest = {
    meta,
    site: {
      site_name: site?.site_name ?? "Download Center",
      site_description: site?.site_description ?? "",
      announcement: site?.announcement ?? ""
    },
    featured: { products: featuredProducts, software: featuredSoftware },
    recent_resources: recentResources
  };

  const devicesManifest = { meta, devices };

  // 5) Write manifests: versioned + stable
  const stableCache = "public, max-age=60";
  const versionedCache = "public, max-age=31536000, immutable";

  const writeBoth = async (stableKey: string, value: any) => {
    const versionedKey = `public/v/${publishId}/${stableKey.replace(/^public\//, "")}`;
    await r2PutJson(ctx, versionedKey, value, { cacheControl: versionedCache });
    await r2PutJson(ctx, stableKey, value, { cacheControl: stableCache });
  };

  await writeBoth("public/manifest-home.json", homeManifest);
  await writeBoth("public/manifest-devices.json", devicesManifest);

  // Per product
  for (const p of products) {
    const seriesRow = seriesByProductId.get(p.id) ?? null;
    const sList = (psByProduct.get(p.id) ?? []).map(publicSoftware);
    const rList = (prByProduct.get(p.id) ?? []).map(publicResource);

    const pm = {
      meta,
      product: publicProduct(p, seriesRow),
      software: sList,
      resources: rList
    };
    await writeBoth(`public/product/${p.slug}.json`, pm);
  }

  // Per software
  for (const s of software) {
    const rList = (srBySoftware.get(s.id) ?? []).map(publicResource);
    const sm = { meta, software: publicSoftware(s), resources: rList };
    await writeBoth(`public/software/${s.slug}.json`, sm);
  }

  // Per resource
  for (const r of resources) {
    const rm = { meta, resource: publicResource(r) };
    await writeBoth(`public/resource/${r.slug}.json`, rm);
  }

  // Optional: search index (simple; refine later)
  const searchIndex = {
    meta,
    index: {
      products: products.map((p: any) => ({
        slug: p.slug,
        name: p.name,
        device_category: p.device_category,
        keywords: [p.name, p.slug, p.remark].filter(Boolean)
      })),
      software: software.map((s: any) => ({
        slug: s.slug,
        name: s.name,
        device_category: s.device_category,
        keywords: [s.name, s.slug, s.remark].filter(Boolean)
      })),
      resources: resources.map((r: any) => ({
        slug: r.slug,
        title: r.title,
        device_category: r.device_category,
        file_category: r.file_category,
        keywords: [r.title, r.slug, r.resource_id, r.platform, r.arch, r.version].filter(Boolean)
      }))
    }
  };
  await writeBoth("public/manifest-search.json", searchIndex);

  // 6) Record publish
  await env.DB.prepare(
    "INSERT INTO publishes (publish_id, note, created_by_email, created_at) VALUES (?, ?, ?, ?)"
  ).bind(publishId, note ?? null, createdByEmail ?? null, nowIso()).run();
}
