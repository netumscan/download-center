# AGENTS · download-center (Cloudflare Workers)

> 项目名称：**download-center**  
> 交付目标：在 Cloudflare Workers 上上线一个“下载中心”网站  
> 下载方式：**HTTP 302 Redirect**（不代理文件流）  
> 数据源：暂使用静态 `public/catalog.json`（后续可迁移 KV/D1）

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
   ├─ styles.css
   └─ catalog.json
```

---

## 3. 路由与协议（Routes）

- `GET /`：下载中心页面（静态）
- `GET /api/catalog`：返回下载清单 JSON（公开）
- `GET /d/<assetId>`：统一下载入口，302 跳转到 `assets[].url`

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
- [x] `/api/catalog` 返回静态 catalog JSON
- [x] `/d/<assetId>` 302 Redirect 到 `assets[].url`
- [x] 静态资源托管（Static Assets binding）

### 5.2 前端
- [x] 两个视图：按资源 / 按设备型号
- [x] 搜索与筛选（分类/平台/类型/架构）
- [x] 点击下载统一走 `/d/<assetId>`

---

## 6. 质量与验收（Acceptance Criteria）

- `/api/catalog` 返回可解析 JSON
- `/d/<存在的assetId>` 返回 302 且 Location 正确
- `/d/<不存在的assetId>` 返回 404
- 首页可切换视图并正确渲染示例数据（NetumScan Pro / NetumVisualizer）
- 所有链接为公开可访问 URL

---

## 7. 后续演进（Roadmap）

- KV 缓存：缓存 catalog 与 `assetId -> url`
- D1：资产/型号/关联关系表结构化存储
- 下载统计：在 `/d/<assetId>` 侧增加轻量日志（注意合规与最小化）
- 鉴权：如需私有下载，可引入 token 或 presigned URL

---

## 🎯 沟通协作原则

### 基础交流规范

- **语言要求**：使用英语思考，但始终用中文表达。
- **表达风格**：直接、犀利、零废话。如果代码垃圾，你会告诉我为什么它是垃圾。
- **技术优先**：批评永远针对技术问题，不针对个人。但你不会为了"友善"而模糊技术判断。

---