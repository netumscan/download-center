# Download Center (Astro on Cloudflare Workers)

一个可直接落地的下载中心项目骨架，满足：
- 公共页：轻度 SSR/CSR，数据优先从 **R2 Manifest** 读取（低成本高性能）
- 后台：走 **Cloudflare Access** 统一登录；后台 API 统一在 `/api/admin/*`
- 文件存储：
  - 小文件（<= 50MB）：后台上传至 **R2**，Worker 负责分发
  - 大文件（> 50MB）：后台只录入 **External URL**，下载走 `/d` -> `/go` 两段式受控跳转并审计
- 审计：所有下载与跳转写入 `download_audit`（使用 `waitUntil`，不阻塞下载）
- 缓存：
  - 公共页完全不查 D1（依赖 Manifest）
  - `/d` 下载元数据使用 KV 读穿缓存（带 **版本戳** `cache_ver:rm`）

---

## 1. 目录结构

- `src/pages/`：Astro 页面 + API 端点
- `src/pages/api/public/*`：公共 API（读 R2 manifest）
- `src/pages/api/admin/*`：后台 API（需 Cloudflare Access 保护）
- `src/pages/d/[resourceSlug].ts`：统一下载入口（R2/External 分流）
- `src/pages/go/[token].ts`：External 短 token 跳转入口
- `src/pages/admin/index.astro`：最小可用后台 UI（资源创建/上传/发布）
- `src/lib/*`：D1/R2/KV/发布/审计等封装
- `migrations/*`：D1 迁移脚本

---

## 2. 前置准备（Cloudflare）

### 2.1 创建资源
1) D1：创建数据库 `download-center-db`
2) R2：创建 bucket `download-center-r2`
3) KV：创建 namespace（用于缓存）

把资源 ID 填入 `wrangler.toml`：
- `database_id`
- `kv namespace id`

### 2.2 配置 Cloudflare Access（后台保护）
建议在 Zero Trust / Access 中配置一条 Application：
- Include：你的团队邮箱/身份源
- Protect Path：
  - `/admin/*`
  - `/api/admin/*`

> 代码层 `requireAdminAccess()` 已返回 Access email 并支持 `admin_roles` RBAC（admin/editor），Access 的强制认证仍由 Cloudflare 在边缘执行。

---

## 3. 本地开发与部署

### 3.1 安装依赖
```bash
npm i
```

### 3.2 应用迁移（D1）
使用 wrangler 执行迁移（示例）：
```bash
wrangler d1 execute download-center-db --file migrations/0001_init.sql
wrangler d1 execute download-center-db --file migrations/0002_roles_publishes.sql
```

### 3.3 本地开发
```bash
npm run dev
```

> 如需 `wrangler dev`，可复制 `.dev.vars.example` 为 `.dev.vars` 并补齐变量。

### 3.4 代码检查与测试
```bash
npm run lint   # astro check
npm test       # node --test 基础逻辑测试（range/allowlist）
```

### 3.4 部署
```bash
npm run deploy
```

---

## 4. 最小可用流程（MVP）

### 4.1 后台录入一条资源
- 访问 `/admin` 页面，按表单创建资源（或直接调用 `POST /api/admin/resources`）
  - `storage_type=R2`：先建资源记录，再走 `/api/admin/upload`
  - `storage_type=EXTERNAL`：必须填 `external_url`（https + allowlist host）

### 4.2 发布（生成 manifest + 更新缓存版本戳）
- `/admin` 页面点击发布，或 `POST /api/admin/publish`
  - 生成 `public/manifest-*.json` 与 `public/v/{publish_id}/...`
  - 更新 KV `cache_ver:rm` 为最新 `publish_id`

发布后公共页会立即读取到最新数据（稳定别名短 TTL + 版本化快照可回滚）。

---

## 5. 安全与注意事项

1) **External URL 永不出现在 public manifest**：public JSON 仅提供 `/d/:slug`
2) `/go/:token`：
   - token 单次使用、60s 过期
   - 仅跳转 allowlist 域名，防开放重定向
3) Admin API 强制 Access + `admin_roles` RBAC（发布需 admin）
4) 审计写入使用 `waitUntil`，失败不阻塞下载

---

## 6. 你可以按需增强的点

- 限速与风控：KV 计数实现 IP+slug 窗口限速
- 审计导出/过滤：按时间段导出 CSV，前端检索
- 更完整的软件列表页：发布时生成专用 manifest（当前复用 search）
- 自动化集成测试：使用 Miniflare/wrangler 对 `/d` `/go` 端到端回归
