# vCard · 社媒卡片 Studio

AI native 的社媒卡片工作台。给主题 → 编辑大纲 → 定制风格 → 生成卡片 → 在工作台里预览、对话编辑、导出。

当前实现包含 web app 与同步 API：HTML 闪卡 / GPT-Image 图片两种模式、5 步真实切换、卡片缩略图侧栏、选中卡片对话编辑、deck/card/generate/chat/export API。

## 文档入口

- [Design Context](./.impeccable.md) — 当前新版前端设计方向
- [技术方案](./docs/tech-design.md) — 当前 API、数据库与前端边界
- [CLAUDE.md](./CLAUDE.md) — AI 协作指南与项目约定

## 仓库结构

```text
apps/api/          Hono on Cloudflare Workers — deck/card/generate/chat/export API
apps/web/          React + Vite web app
packages/          shared-types: 前后端共享类型
docs/              tech-design, fixtures
sandbox/agent-base/ 历史 spike，仅作参考
```

## 前置依赖

- Node >= 20（见 `.nvmrc`）
- npm >= 10
- Neon Postgres 实例（或自建 Postgres + HTTP proxy）

## 本地启动

安装依赖：

```bash
npm ci
```

API 只需要 `DATABASE_URL`。完整本地预览：

```bash
npm run dev:full
```

`dev:full` 会先把 Worker 必需变量 `DATABASE_URL` 同步到 `apps/api/.dev.vars`，再启动：

- API: `http://localhost:8787`
- 前端: `http://127.0.0.1:5173`

只跑 web app：

```bash
npm run dev:studio
```

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

## CI

`.github/workflows/ci.yml` 在 PR 与 main push 上跑两个 job：

- **Typecheck** — workspace-wide `tsc --noEmit`，不依赖 secrets
- **Test (vitest + Neon)** — 跑 `db:migrate` → `vitest run`，依赖 `DATABASE_URL_TEST` secret；fork PR 上自动跳过

## 部署

Cloudflare Workers + Neon Postgres。

部署顺序：

1. 先 migrate：`npm run -w @vcard/api db:migrate`（指向生产 `DATABASE_URL`）
2. 再 deploy：`wrangler deploy`（在 `apps/api/`）
