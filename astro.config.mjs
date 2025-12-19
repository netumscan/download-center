import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Use Workers runtime; Astro will generate a Worker entry for wrangler deploy.
    // https://docs.astro.build/en/guides/deploy/cloudflare/
  }),
  integrations: [tailwind()],
  // Public pages can be SSR; manifests are fetched from R2 via API endpoints.
  // You may enable prerender per-page later.
});
