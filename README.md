# download-center

Cloudflare Workers + Static Assets 实现的公开下载中心（Redirect 302）。

## Features
- 统一下载入口：`/d/<assetId>` 302 跳转到真实下载地址
- 两种浏览方式：
  - 按资源分类（桌面/手机/文档）
  - 按设备型号（扫描枪/打印机/拍印机/高拍仪）
- 数据源：`public/catalog.json`（后续可迁移 KV/D1）

## Quick Start
```bash
npm install
npx wrangler dev
```

## Deploy
```bash
npx wrangler deploy
```

## Update Catalog
编辑 `public/catalog.json`：
- `assets[]`：新增/更新资源
- `devices[]`：设备型号关联资源（通过 `assetId` 引用）
