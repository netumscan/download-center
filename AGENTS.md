# AGENTS.md — Download Center (Astro + Cloudflare Workers)

> 目标：交付一个“可直接上线”的下载中心，支持按设备/按软件浏览、资源受控下载与审计，并具备可扩展的发布/缓存策略。

---

## 1. 系统边界与职责

### 1.1 Public（对外）
- 展示：主页、设备分类/系列/产品、软件页、资源详情
- 数据来源：**R2 Manifest（JSON 快照）**
- 不依赖 D1（除下载入口 `/d` 与跳转 `/go`）

### 1.2 Admin（后台）
- 登录：统一走 **Cloudflare Access**
- 能力：CRUD（产品/系列/软件/资源/关联关系）、小文件上传到 R2、大文件录入外链、发布生成 Manifest、审计查看

### 1.3 Download（统一下载入口）
- `/d/:slug`：统一下载入口（R2 流式返回 / External token 跳转）
- `/go/:token`：External 单次短 token 跳转（allowlist + 审计）

---

## 2. 数据模型（D1 / SQLite）

核心实体：
- `product_series`：设备分类下的产品系列
- `products`：产品页（可关联 software 与 resources）
- `software`：软件页（可关联 resources）
- `file_resources`：文件资源（资源ID/分类/设备分类/大小/sha256 + storage）
- 关联表：`product_software / product_resources / software_resources`
- 审计：`download_audit`
- token：`download_tokens`
- 发布：`publishes`
- 权限（可选）：`admin_roles`

---

## 3. 发布与缓存策略（关键设计）

### 3.1 Manifest（R2）
稳定别名：
- `public/manifest-home.json`
- `public/manifest-devices.json`
- `public/product/{slug}.json`
- `public/software/{slug}.json`
- `public/resource/{slug}.json`
- `public/manifest-search.json`
- `public/software-list` API 复用搜索索引

版本快照：
- `public/v/{publish_id}/...`

### 3.2 KV（下载元数据缓存）
- 版本戳：`cache_ver:rm = publish_id`
- 缓存 key：`rm:{publish_id}:{resourceSlug}`
- value：下载最小字段（不包含 external_url）

目的：
- 避免 `/d` 每次命中 D1
- 发布后仅更新版本戳即可全量失效

---

## 4. 工程实施分阶段（与当前代码一致）

### 阶段 1：Public 读 R2 Manifest
- Public API 只读 R2
- 页面从 Public API 拉取数据渲染

### 阶段 2：`/d` 读穿 KV，回源 D1
- KV miss 才查 D1
- 回填 KV（TTL 10-15 分钟）

### 阶段 3：审计 `waitUntil` 不阻塞下载
- 插入 `download_audit` 失败不影响下载

### 阶段 4：External token 跳转闭环
- token 60s 过期、单次使用
- allowlist 域名校验
- 防开放重定向

### 阶段 5：发布生成 Manifest + 更新缓存版本
- `/api/admin/publish`：
  - 生成所有 manifest（版本化 + 稳定别名）
  - 更新 `cache_ver:rm`
  - 写 `publishes`

---

## 5. 代码所有权与协作约定

### 5.1 模块边界
- `src/lib/manifest.ts`：发布时组装 manifest 的唯一入口
- `src/pages/d/*` 与 `src/pages/go/*`：下载链路与审计
- `src/pages/api/public/*`：public 只读接口
- `src/pages/api/admin/*`：后台写接口（Access 保护）
- `/admin`：最小可用后台 UI（资源创建/上传/发布）

### 5.2 安全红线
- public manifest / public API 严禁返回 `external_url`
- `/go` 不接受任何外部传入 URL 参数
- External host 必须在 allowlist
- Admin API 必须校验 Access + `admin_roles`（发布仅 admin）

### 5.3 质量要求
- 所有 API 返回 JSON，包含明确错误码
- D1 SQL 变更必须通过 `migrations/` 管理
- 发布接口必须可重入（失败可重试，不破坏数据一致性）
- 保持最小回归：`npm run lint`（astro check），`npm test`（基础逻辑单测）

---

## 6. Backlog（建议增强项）
- 资源列表页与筛选（单独 manifest）
- 审计导出 CSV
- 限速与 Bot 防护（KV 计数 + WAF 规则）
- 自动化端到端测试（Miniflare/Wrangler 覆盖 `/d` `/go`）

---

## 🎯 沟通协作原则

### 基础交流规范

- **语言要求**：使用英语思考，但始终用中文表达。
- **表达风格**：直接、犀利、零废话。如果代码垃圾，你会告诉我为什么它是垃圾。
- **技术优先**：批评永远针对技术问题，不针对个人。但你不会为了"友善"而模糊技术判断。
