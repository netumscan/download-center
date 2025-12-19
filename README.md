# download-center

Cloudflare Workers + Static Assets + D1 + KV 的公开下载中心（302 Redirect）。

## Features
- 统一下载入口：`/d/<assetId>` 302 跳转到真实下载地址
- 两种浏览方式：
  - 按资源分类（桌面/手机/文档）
  - 按设备型号（扫描枪/打印机/拍印机/高拍仪）
- 数据源：D1 结构化存储（版本化），KV 缓存（含 version 化键），静态 `public/catalog.json` 兜底
- 管理页面：`/admin`（需 `ADMIN_TOKEN`），可导入 catalog 到 D1，手动刷新 KV 并下载最新 JSON

## Quick Start
```bash
npm install
npx wrangler dev
```

## Deploy
自动创建 D1 / KV（占位符存在时）
```bash
npm run deploy
# 等价于：npm run provision && wrangler deploy
```
要求：`wrangler login` 或设置 API Token，首次会创建 D1/KV 并写回 `wrangler.toml`，之后跳过。

## 仅使用 Cloudflare 可视化部署（控制台绑定 GitHub）时的最低配置
- 在 Cloudflare 控制台创建 D1 数据库并获取 `database_id`/`database_name`，填入 `wrangler.toml`
- 创建 KV Namespace（绑定名 `CACHE`），将 `id` 填入 `wrangler.toml`
- 在控制台为 Worker 设置 `ADMIN_TOKEN`（Secret），用于 `/admin` 管理端
- 无需在仓库或 CI 中配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，控制台已有账户上下文

## Update Catalog
方式一：静态文件（兜底）
- 编辑 `public/catalog.json`，`/api/catalog` 会在 D1/KV 缺失时回退此文件。

方式二：管理页 `/admin`（推荐）
- 设置 `ADMIN_TOKEN`：`wrangler secret put ADMIN_TOKEN`
- 确认 `wrangler.toml` 已配置 D1 绑定（`DB`）与静态 run_worker_first 包含 `/admin/*`
- 打开 `/admin`，填写 Token（保存在浏览器），粘贴包含 `assets` / `devices` 的 catalog JSON
- 点「发布并写入 KV」：导入 D1、新建已发布版本、写入 KV（`catalog:<version>` / `asset:<version>:<id>`）、缓存 version_id
- 点「从 D1 读取已发布版本，写入 KV，并下载 JSON」：读取最新已发布版本，刷新 KV，并下载当前 catalog JSON
