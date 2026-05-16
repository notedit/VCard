# 仓库结构与架构

vCard 已从「社媒卡片 Studio web app」转向 **landing page + skills** 形态。本文是当前结构、命令、部署方式的单一真相源。

## 目录结构

```text
landing/        纯静态 Vite + React 落地页,部署到 Cloudflare Workers 静态资产
skills/         产品:两个独立 agent skill
  text-card-generator/    HTML/CSS + Playwright 渲染确定性文字卡
  image-card-generator/   GPT-image-2 生成信息优先的图片卡
.claude/skills -> ../skills   项目级 skills 软链接(指向仓库根 skills/)
legacy/         旧 monorepo 归档(可独立运行,不作为实现依据)
  apps/web/     旧卡片工作台 React + Vite web app
  apps/api/     旧 Hono on Cloudflare Workers — deck/card/generate/chat/export API
  packages/     shared-types: 旧前后端共享类型
  sandbox/      历史 spike
  scripts/      旧 dev 脚本(dev-full / sync-dev-vars / sync-skills-to-vcard-skills)
  docs/         tech-design.md(冻结,仅描述旧实现)、landing-skills-brief.md
docs/           本文档(当前架构真相源)
.impeccable.md  前端设计方向
```

## landing（当前主线）

纯静态站,无后端、无密钥。组件从旧 `apps/web/src/App.tsx` 的 `LandingPage` 提取而来,只依赖自带的 `Icon` 组件。

```bash
npm --prefix landing install   # 或仓库根 npm ci 后进 landing
npm run dev        # = npm --prefix landing run dev,本地预览 :5173
npm run typecheck  # tsc --noEmit
npm run build      # vite build → landing/dist/
npm run preview    # 预览构建产物
```

仓库根 `package.json` 的 `dev/build/preview/typecheck/deploy` 均委托给 `landing/`。

## skills（产品）

`skills/` 下两个目录是 agent skill,装进任意能读本地 skills 目录的 coding agent 即可用。安装方式见 landing 页面 `#install` 段;`.claude/skills -> ../skills` 是项目级 skills 目录约定的真实例证。skills 本身不需要构建。

## 部署

landing 用 **Cloudflare Workers 静态资产**部署（`landing/wrangler.toml` 的 `[assets]`）。

```bash
npm --prefix landing run build
npm --prefix landing run deploy   # vite build && wrangler deploy
```

首次部署需 `wrangler login`，或配置环境变量 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。CI/自动部署见 `.github/workflows/`。

## legacy（归档,不演进）

旧 monorepo 整体移入 `legacy/`,workspace 路径相对 `legacy/` 仍正确,可独立运行:

```bash
cd legacy && npm install && npm run typecheck   # 全 workspace 通过
```

旧 API/数据库/前端边界见 `legacy/docs/tech-design.md`（已冻结）。**不要在 `legacy/` 里做新功能**；要复用旧能力时先评估是否搬出归档。`legacy/scripts/sync-skills-to-vcard-skills.mjs` 用 `import.meta.url` 推算仓库根,移入 `legacy/` 后基准目录变为 `legacy/`,新根不再暴露 `sync:skills`。

## 前置依赖

- Node >= 20（见根 `.nvmrc`）
- npm >= 10
- landing 无其他依赖；legacy 的 API 需 Neon Postgres `DATABASE_URL`（仅在 `legacy/` 内运行时）
