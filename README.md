# VCard · 卡片 · 社媒 Studio

AI native 的社媒卡片工作台。给主题 → 出爆款图文。

平台优先入口、Agent 推进的可对话 Plan、可叠加的 Skills 能力包、gpt-image-2 主体一致性 + 中文文字烧入。

## 文档入口

- [完整 PRD](./design/public/prd.html) — 产品需求、里程碑、技术选型
- [Visual System](./design/docs/visual-system.md) — 设计规范
- [M1 技术方案](./docs/tech-design.md) — 工程蓝本：技术栈、架构、模块、数据模型、关键流程
- [CLAUDE.md](./CLAUDE.md) — AI 协作指南与项目约定

## 仓库结构

```
apps/api/          Hono on Cloudflare Workers — Plan / Edit / Suggestion agents + image queue consumer
design/            React + Vite wireframes (低保真草图，中保真未启动)
packages/          shared-types: 前后端共享类型
docs/              tech-design, fixtures, m1-test-resources
sandbox/agent-base/ pivot-pre spike, 已不参与 M1 (保留作为参考)
```

## 前置依赖

- Node ≥ 20（见 `.nvmrc`）
- npm ≥ 10
- Neon Postgres 实例（或自建 Postgres + HTTP proxy）
- AIHubMix 账号（统一 LLM 网关）

## 本地启动

### 1. 装依赖

```bash
npm ci
```

### 2. 注入 secrets

API key 统一从 `~/.secrets/common.env` 读取（**不要**写进仓库）：

```bash
set -a && . ~/.secrets/common.env && set +a
```

需要的环境变量见 `apps/api/.dev.vars.example`。把它复制到 `apps/api/.dev.vars`（已 gitignore），从环境变量填入：

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
# 然后用上面注入的环境变量填充各 key
```

### 3. 跑数据库迁移

```bash
npm run -w @vcard/api db:migrate
```

> 注：先 migrate，再起服。生产部署同样**先 migrate 再 deploy**。

### 4. 起服务

```bash
# API（Workers / Hono）
npm run -w @vcard/api dev

# 前端 wireframe（独立）
npm run -w design dev
```

## 测试

```bash
# 全 workspace
npm test

# 仅 API（vitest + Neon test branch）
npm run -w @vcard/api test
```

测试用一个独立的 Neon test branch（CI 通过 `DATABASE_URL_TEST` secret 注入），TRUNCATE between cases，所以 `vitest.config.ts` 设了 `singleFork: true` 串行跑。

可选的真实 LLM / gpt-image-2 测试默认跳过，靠 env flag 启用：

```bash
RUN_REAL_IMAGE_TEST=1 npm run -w @vcard/api test
```

## 类型检查

```bash
npm run typecheck   # 全 workspace
```

## CI

`.github/workflows/ci.yml` 在 PR 与 main push 上跑两个 job：

- **Typecheck** — workspace-wide `tsc --noEmit`，不依赖 secrets
- **Test (vitest + Neon)** — 跑 `db:migrate` → `vitest run`，依赖 `DATABASE_URL_TEST` secret；fork PR 上自动跳过

## 部署

> Workers + Cloudflare Queues + R2 + Durable Objects。

部署顺序：

1. **先 migrate**：`npm run -w @vcard/api db:migrate`（指向生产 DATABASE_URL）
2. **再 deploy**：`wrangler deploy`（在 `apps/api/`）
