# VCard · 卡片 · 社媒 Studio

AI native 的社媒卡片工作台。给主题 → 选 Skill → 生成信息卡片 → 轻编辑 → 导出。

平台优先入口、Agent 推进的可对话 Plan、可叠加的 Skills 能力包、gpt-image-2 主体一致性 + 中文文字烧入。

## 文档入口

- [完整 PRD](./design/public/prd.html) — 产品需求、里程碑、技术选型
- [Visual System](./design/docs/visual-system.md) — 设计规范
- [M1 技术方案](./docs/tech-design.md) — 工程蓝本：技术栈、架构、模块、数据模型、关键流程
- [CLAUDE.md](./CLAUDE.md) — AI 协作指南与项目约定

## 仓库结构

```text
apps/api/          Hono on Cloudflare Workers — Plan / Edit / Suggestion agents + image queue consumer
design/            React + Vite frontend prototype and Studio
packages/          shared-types: 前后端共享类型
docs/              tech-design, fixtures, m1-test-resources
sandbox/agent-base/ pivot-pre spike, 已不参与 M1 (保留作为参考)
```

## 前置依赖

- Node >= 20（见 `.nvmrc`）
- npm >= 10
- Neon Postgres 实例（或自建 Postgres + HTTP proxy）
- AIHubMix 账号（统一 LLM 网关）

## 本地启动

安装依赖：

```bash
npm ci
```

API key 统一从 `~/.secrets/common.env` 读取，不要写进仓库。完整本地预览使用 Wrangler 绑定：

```bash
npm run dev:full
```

`dev:full` 会先把 Worker 必需变量 `DATABASE_URL`、`AIHUBMIX_API_KEY` 同步到 `apps/api/.dev.vars`，再启动：

- API: `http://localhost:8787`
- 前端: `http://127.0.0.1:5173`

分开调试时可以跑：

```bash
npm run dev:vars
npm run dev:api
npm run dev:studio
```

首次使用或数据库结构变化后先跑迁移：

```bash
npm run -w @vcard/api db:migrate
```

## 测试

```bash
npm run typecheck
npm test
npm run build
```

测试用独立的 Neon test branch（CI 通过 `DATABASE_URL_TEST` secret 注入），会在用例间清表。`apps/api/vitest.config.ts` 关闭了文件并行，避免共享测试库互相 `TRUNCATE`。

可选的真实 LLM / gpt-image-2 测试默认跳过，靠 env flag 启用：

```bash
RUN_REAL_IMAGE_TEST=1 npm run -w @vcard/api test
RUN_REAL_ANTHROPIC_TEST=1 npm run -w @vcard/api test
```

## CI

`.github/workflows/ci.yml` 在 PR 与 main push 上跑两个 job：

- **Typecheck** — workspace-wide `tsc --noEmit`，不依赖 secrets
- **Test (vitest + Neon)** — 跑 `db:migrate` → `vitest run`，依赖 `DATABASE_URL_TEST` secret；fork PR 上自动跳过

## 部署

Workers + Cloudflare Queues + R2 + Durable Objects。

部署顺序：

1. 先 migrate：`npm run -w @vcard/api db:migrate`（指向生产 `DATABASE_URL`）
2. 再 deploy：`wrangler deploy`（在 `apps/api/`）
