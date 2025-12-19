# AGENTS · download-center (Cloudflare Workers)

> 项目名称：**download-center**  
> 交付目标：在 Cloudflare Workers 上上线一个“下载中心”网站  
> 下载方式：**HTTP 302 Redirect**（不代理文件流）  
> 数据源：D1（结构化存储）+ KV 缓存，静态 `public/catalog.json` 作为兜底

---

## 1. 项目范围（Scope）

### 1.1 支持的下载分类（按资源）
- 桌面端软件（含驱动）：Windows / macOS / Linux（可按 CPU 架构区分）
- 手机端软件：Android / iOS（预留）
- 文档：主要为 PDF（预留其他格式）

### 1.2 支持的设备分类（按设备）
- 扫描枪 / 打印机 / 拍印机 / 高拍仪
- 每个型号可关联：软件/驱动/APP/使用文档（通过 `assetId` 关联）

---

## 2. 目录结构（Layout）

```text
download-center/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ wrangler.toml
├─ src/
│  └─ worker.js
└─ public/
   ├─ index.html
   ├─ app.js
   ├─ admin.html
   ├─ admin.js
   ├─ styles.css
   └─ catalog.json
```

---

## 3. 路由与协议（Routes）

- `GET /`：下载中心页面（静态）
- `GET /admin`：管理页面（需设置 Admin Token）
- `GET /api/catalog`：返回下载清单 JSON（公开）
- `GET /d/<assetId>`：统一下载入口，302 跳转到 `assets[].url`
- Admin API（需 `Authorization: Bearer <ADMIN_TOKEN>`）：
  - `GET /admin/api/version`：查询当前已发布的 version_id
  - `POST /admin/api/refresh`：从 D1 读取最新版本，写入 KV，并返回 JSON
  - `POST /admin/api/import`：导入 catalog JSON 到 D1 并发布，同时写入 KV（返回 version_id）

---

## 4. 数据规范（catalog.json）

### 4.1 assets（资源池）
必填：
- `id`：唯一资源 ID（发布后尽量稳定）
- `category`：`desktop` / `mobile` / `docs`
- `subtype`：`app` / `driver` / `manual` / `spec`
- `name`：显示名称
- `type`：`s3` / `direct`（仅展示用）
- `url`：最终下载地址（公开可访问）

可选：
- `platform`：`windows` / `macos` / `linux` / `android` / `ios`
- `arch`：如 `x86` / `x64` / `arm64` / `amd64`
- `format`：文档常用 `pdf`
- `version` / `releaseDate` / `sha256` / `size`

### 4.2 devices（设备与型号）
- `deviceType`：`scanner` / `printer` / `photo_printer` / `document_scanner`
- `models[]`：型号集合
  - `model`：型号名称（显示）
  - `links[]`：关联资源
    - `assetId`：引用 assets.id
    - `label`：显示标签（如“Windows x64”“使用文档”）
    - `role`：`required` / `recommended` / `optional`
    - `sort`：排序（数字越小越靠前）

---

## 5. 开发任务（Work Items）

### 5.1 Worker
- [x] `/api/catalog` 返回 catalog JSON（优先 KV，命中 D1，静态兜底，带 version 化缓存）
- [x] `/d/<assetId>` 302 Redirect 到 `assets[].url`（支持 KV 版跳转缓存）
- [x] 静态资源托管（Static Assets binding）
- [x] D1 接入：按最新已发布 version 读取 assets/devices/links 组装 catalog
- [x] 管理 API：导入/刷新写 KV，查询当前 version

### 5.2 前端
- [x] 两个视图：按资源 / 按设备型号
- [x] 搜索与筛选（分类/平台/类型/架构）
- [x] 点击下载统一走 `/d/<assetId>`
- [x] 管理页 `/admin`：录入 Admin Token、粘贴 catalog JSON 导入到 D1、手动刷新 KV 并下载最新 JSON

---

## 6. 质量与验收（Acceptance Criteria）

- `/api/catalog` 返回可解析 JSON
- `/d/<存在的assetId>` 返回 302 且 Location 正确
- `/d/<不存在的assetId>` 返回 404
- 首页可切换视图并正确渲染示例数据（NetumScan Pro / NetumVisualizer）
- 所有链接为公开可访问 URL
- 管理页：导入 catalog 成功返回 version_id，刷新操作会将最新已发布版本写入 KV，并返回可下载的 JSON

---

## 7. 后续演进（Roadmap）

- 下载统计：在 `/d/<assetId>` 侧增加轻量日志（注意合规与最小化）
- 鉴权：如需私有下载，可引入 token 或 presigned URL
- 自动化：部署前自动创建 D1/KV（占位符检测 + wrangler create）

---

## 🎯 沟通协作原则

### 基础交流规范

- **语言要求**：使用英语思考，但始终用中文表达。
- **表达风格**：直接、犀利、零废话。如果代码垃圾，你会告诉我为什么它是垃圾。
- **技术优先**：批评永远针对技术问题，不针对个人。但你不会为了"友善"而模糊技术判断。

---
