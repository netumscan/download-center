#!/usr/bin/env node
/**
 * Auto-provision D1 + KV on deploy.
 * Requires: `wrangler` logged in or API token envs set.
 * Behavior:
 * - If wrangler.toml still has placeholder IDs, create resources and replace IDs.
 * - Safe to re-run; will skip if IDs are already set (no "replace-with-..." string).
 */
import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const ROOT = path.join(process.cwd(), "wrangler.toml");
const D1_PLACEHOLDER = "replace-with-your-d1-id";
const KV_PLACEHOLDER = "replace-with-your-kv-id";

function run(cmd) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf-8" }).trim();
}

function readToml() {
  return fs.readFileSync(ROOT, "utf-8");
}

function writeToml(content) {
  fs.writeFileSync(ROOT, content);
}

function provisionD1(toml) {
  if (!toml.includes(D1_PLACEHOLDER)) {
    console.log("D1 already configured, skip.");
    return toml;
  }
  console.log("Creating D1 database...");
  const output = run("npx wrangler d1 create download-center-db");
  const match = output.match(/id:\\s*([a-f0-9\\-]+)/i);
  if (!match) {
    throw new Error("Failed to parse D1 id from output:\\n" + output);
  }
  const id = match[1];
  console.log("D1 created:", id);
  return toml.replace(D1_PLACEHOLDER, id);
}

function provisionKV(toml) {
  if (!toml.includes(KV_PLACEHOLDER)) {
    console.log("KV already configured, skip.");
    return toml;
  }
  console.log("Creating KV namespace...");
  const output = run("npx wrangler kv:namespace create download-center-cache --binding=CACHE");
  const match = output.match(/id:\\s*([a-f0-9]{32})/i);
  if (!match) {
    throw new Error("Failed to parse KV id from output:\\n" + output);
  }
  const id = match[1];
  console.log("KV created:", id);
  return toml.replace(KV_PLACEHOLDER, id);
}

function main() {
  let toml = readToml();
  const original = toml;
  toml = provisionD1(toml);
  toml = provisionKV(toml);
  if (toml !== original) {
    writeToml(toml);
    console.log("wrangler.toml updated with new IDs.");
  } else {
    console.log("wrangler.toml unchanged.");
  }
}

main();
