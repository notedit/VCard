# CLAUDE.md

为在此仓库工作的 AI 编码助手准备的项目指南。

> **写入约束**：CLAUDE.md 只放**最重要、最稳定**的内容。经常变化的信息（仓库结构、当前里程碑、范围、命令清单等）不要写进来 —— 它们应该放在对应的源文件 / 文档里，让 CLAUDE.md 保持长期有效。

## 项目

**卡片 · 社媒 Studio** —— AI native 的社媒卡片工作台。给主题、出爆款图文。
核心差异化：平台优先入口、Agent 推进的可对话 Plan、可叠加的 Skills 能力包、gpt-image-2 主体一致性 + 中文文字烧入。

## 必读文档

- **[Visual System 设计规范](./design/docs/visual-system.md)** — 中保真起所有视觉决定的依据：设计哲学、色彩、字体、组件、间距、Voice & Tone、Motion。
- **[完整 PRD](./design/public/prd.html)** — 产品需求、里程碑、技术选型、验收标准、风险。
- **[技术方案 (M1)](./docs/tech-design.md)** — 工程蓝本：技术栈、架构、模块、数据模型、关键流程、验证策略、里程碑。

## 实现约定

- `design/` 里的屏幕是 **wireframe 低保真草图**（手绘风），仅用于 wireframe 阶段。中保真 / 生产实现必须改为按 [Visual System](./design/docs/visual-system.md) 执行。
- Voice & Tone 规则适用于**所有** AI 输出文案，不限于 UI。

## 工作流程

### GitHub Issue 联动

如果任务来源于 GitHub Issue，全程通过 `gh issue comment` 同步状态：

- **开始开发时**：留言 "Working on this"，说明初步思路。
- **Plan 确定后**：将方案摘要（改动范围、关键决策）同步到 Issue。
- **Plan 有重大变更时**：更新 Issue 说明变更原因和新方案。
- **提交 PR 时**：用 `gh pr create --body "Closes #<issue>"` 或 `Fixes #<issue>` 绑定 Issue，确保 PR 合并后自动关闭 Issue。

### 验证先行

开发新功能前先确定验证方式：写测试、定义可观测指标、或准备手动验证步骤。**确保改动可被验证后再动手。**

### 技术方案同步

`docs/tech-design.md` 是 M1 工程实现的单一真相源。**关键方案变更必须同步更新该文档**：

- **触发条件**：技术栈调整、架构边界变化、模块拆分变动、数据模型增删、关键流程改动、验证 / 风险条目新增。
- **更新动作**：在同一 PR 里改代码 + 改文档；不允许文档与实现脱节。
- **小改动免同步**：bug 修复、变量重命名、单测补全、不改外部行为的重构。
