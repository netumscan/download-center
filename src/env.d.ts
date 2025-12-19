/// <reference types="astro/client" />

type DeviceCategory = "scanner" | "document_camera" | "printer" | "other";
type FileCategory = "desktop_software" | "mobile_software" | "product_specs" | "user_manual" | "firmware";
type StorageType = "R2" | "EXTERNAL";

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  KV_CACHE: KVNamespace;
  EXTERNAL_ALLOWLIST?: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}
