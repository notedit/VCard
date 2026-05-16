# vCard

装进 coding agent 的社媒卡片 skill。给一篇文章、一段笔记或一个主题，让你的 coding agent 排成一整套高质感社媒卡片。

形态是 **landing page + skills**：

- `skills/` 是产品 —— 两个独立 agent skill：`text-card-generator`（HTML/CSS + Playwright 渲染确定性文字卡）、`image-card-generator`（GPT-image-2 生成图片卡）。
- `landing/` 是纯静态落地页，讲清两个 skill 是什么、怎么装、怎么触发，部署到 Cloudflare。
- `legacy/` 是旧的「社媒卡片 Studio」web app + 同步 API，已归档，仅供后续可能复用。

## 文档入口

- [仓库结构与架构](./docs/architecture.md) — 当前结构、命令、部署（单一真相源）
- [Design Context](./.impeccable.md) — 前端设计方向
- [CLAUDE.md](./CLAUDE.md) — AI 协作指南与项目约定
- [遗留技术方案](./legacy/docs/tech-design.md) — 仅描述 `legacy/` 旧实现

## 快速开始

```bash
npm --prefix landing install
npm run dev        # 本地预览落地页 http://localhost:5173
npm run build      # 构建到 landing/dist/
npm run preview    # 预览构建产物
```

仓库根脚本 `dev/build/preview/typecheck/deploy` 均委托给 `landing/`。

## 使用 skills

`skills/` 下两个目录可装进任意能读本地 skills 目录的 coding agent（Codex 读 `~/.codex/skills/`，Claude Code 读 `.claude/skills/`，通用 agent 多读 `.agents/skills/`）。完整安装与触发方式见落地页 `#install` 段。

## 部署

landing 用 Cloudflare Workers 静态资产部署：

```bash
npm --prefix landing run deploy   # vite build && wrangler deploy
```

首次需 `wrangler login` 或配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。详见 [docs/architecture.md](./docs/architecture.md)。

## legacy

旧 monorepo 已整体归档到 `legacy/`，可独立运行（`cd legacy && npm install && npm run typecheck`），但不再作为实现依据，也不在 `legacy/` 内开发新功能。
