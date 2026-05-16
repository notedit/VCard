# AGENTS.md

为在此仓库工作的 AI 编码助手准备的项目指南。

> **写入约束**：AGENTS.md 只放**最重要、最稳定**的内容。经常变化的信息（仓库结构、当前里程碑、范围、命令清单等）不要写进来 —— 它们应该放在对应的源文件 / 文档里，让 AGENTS.md 保持长期有效。

## 项目

**vCard** —— 装进 coding agent 的社媒卡片 skill。形态是 **landing page + skills**：

- `skills/` 是真正的产品 —— 两个独立 agent skill（`text-card-generator` 用 HTML/CSS + Playwright 渲染文字卡，`image-card-generator` 用 GPT-image-2 生成图片卡），装进任意 coding agent 即可用。
- `landing/` 是一个纯静态站，讲清两个 skill 是什么、怎么装、怎么触发，部署到 Cloudflare。
- `legacy/` 是旧的「社媒卡片 Studio」web app + 同步 API + sandbox，已归档，不再作为实现依据，仅供后续可能复用。

## 必读文档

- **[仓库结构与架构](./docs/architecture.md)** — 当前 landing + skills + legacy 的边界与本地/部署命令。
- **[Design Context](./.impeccable.md)** — 前端设计方向：极简专业、黑白灰 + 一个强调色。
- **[遗留技术方案](./legacy/docs/tech-design.md)** — 仅描述 `legacy/` 旧实现的 API/数据库/前端边界，**不代表当前架构**。

## 实现约定

- 当前可演进的代码是 `landing/`（纯静态 Vite + React）与 `skills/`（产品）。**不要在 `legacy/` 里做新功能**；要复用旧能力时先讨论是否搬出归档。
- `skills/` 与 `.claude/skills -> ../skills` 符号链接是产品入口，保持在仓库根。
- Voice & Tone 规则适用于**所有** AI 输出文案，不限于 UI。
- **本地密钥从 `~/.secrets/common.env` 读取**；不要把真值写进仓库内任何文件。`landing/` 是纯静态站，不需要任何密钥；部署密钥见 `docs/architecture.md`。

## 工作流程

开发新功能前先确定验证方式：写测试、定义可观测指标、或准备手动验证步骤。**确保改动可被验证后再动手。**

架构边界、命令、部署方式的单一真相源是 `docs/architecture.md`。**关键结构 / 部署变更必须在同一 PR 同步更新该文档**。`legacy/docs/tech-design.md` 已冻结，只读不更新。
