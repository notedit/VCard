# 卡片 · 社媒 Studio — 技术方案 (M1)

> **状态**：M1 设计稿 · 2026-05-03  
> **范围**：M1（小红书单平台 MVP），M2-M4 仅做前向兼容标注  
> **关联文档**：[PRD](../design/public/prd.html) · [Visual System](../design/docs/visual-system.md) · [Wireframe 屏幕](../design/src/screens/)  
> **关联 Issue**：[#1 技术方案设计](https://github.com/notedit/VCard/issues/1)

---

## 0. 设计前提

| 约束 | 决策 |
|---|---|
| 技术栈 | 全栈 TypeScript（仅例外：无） |
| API 部署 | Cloudflare Workers |
| Agent 运行时 | Cloudflare Containers（生产）/ Docker（本地） |
| Agent 框架 | Pi Coding Agent SDK (`@mariozechner/pi-coding-agent`) |
| 文字校验 | **不做 OCR**，gpt-image-2 直出 + 用户主动重生 |
| 验证策略 | 验证先行（CLAUDE.md），每个 P0 验收先定测试形态 |

> 与 PRD § 13 的差异：原方案的 PaddleOCR 已移除；中文烧字校验（PRD § 09 "OCR ≥ 92%"）改为"人评抽样 ≥ 90%"，**需 PRD 同步更新**。

---

## 0.1 M1 架构决策修订（2026-05-04）

经过容器路径风险评估 + AIHubMix / Neon 验证后，**M1 不再使用 Cloudflare Containers + Pi Coding Agent SDK**。改用 **Workers + Vercel AI SDK `ToolLoopAgent`**：

- **Plan / Edit / Suggestion** 三条 agent 都跑在 Workers 内，用 `ai` 包的 `ToolLoopAgent` + `createAgentUIStreamResponse`（标准 AI SDK UI Stream → 前端 `@ai-sdk/react useChat` 直接吃）
- **Tools** 用 `tool({ inputSchema: zod, execute })`，execute 闭包持 Drizzle handle 直写 Neon + ChangeLog
- **Skills** 作为 KV 表 + 静态导入；M2 marketplace 走 D1
- **Image Service** 维持原方案：Workers 直接 `openai` SDK 调 gpt-image-2 + Queue + GenJob DO fan-out（§5.4 不变）
- **`sandbox/agent-base/`** 作为 spike 参考保留，**不再动**；M2+ 真要 sandbox（user-authored 可执行 skill / Python tool / >5min 任务）时反向引入

**为什么改**：
1. 三条 agent 时长（Plan ≤2min / Edit <5s / Suggestion <10s）全部能在 Workers 5min wall-time 内；`await fetch` 不计 CPU。
2. PRD §08 Skill schema 全是 JSON metadata + Markdown，**无可执行代码** → 不需要进程隔离。
3. 状态恢复本来就在 PG/DO storage 层，容器 fs sessions 是反模式（CF Containers 无持久卷）。
4. 一并消除 §10 两条 P0 风险（CF Containers 演进 / Pi 个人项目维护）。
5. 测试矩阵从 `miniflare + Docker + 真实 LLM` 缩到 `miniflare + 真实 LLM`。

下文 §4（Container 生命周期与池化）整段标 **⚠️ M2+ deferred**；§5.2 / §5.5 / §5.6 流程已用 ToolLoopAgent 覆写。原始容器方案保留作历史，便于 M2+ 反向引入时参考。

---

## 1. 范围

| 阶段 | In scope (M1) | Out of scope (M2+) |
|---|---|---|
| 平台 | 小红书 (4:5 / 9 张) | 小绿书、公众号长图文、抖音、微博 |
| Skills | 3 个内置（爆款标题手 / 小红书种草体 / 真实摄影） | Skills 市场、自建、分享 |
| 编辑 | ⌘K 自然语言 + Agent 主动建议 + 撤回 | — |
| 出口 | ZIP 打包导出 | OAuth 直发、跨平台改版 |
| 视觉 | gpt-image-2 + 主体一致 + 中文文字烧入 | — |

---

## 2. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | React 18 + Vite + TypeScript | 沿用 `design/`，按 Visual System 重做中保真；部署到 Cloudflare Pages |
| **API 层** | **Hono on Cloudflare Workers** | Workers Runtime 原生 / 极轻 / TS 一等公民。承担：路由、鉴权、CRUD、SSE，**包含 agent loop**（M1 决策修订，见 §0.1） |
| **Agent 框架** | **Vercel AI SDK** (`ai` v6) — `ToolLoopAgent` + `createAgentUIStreamResponse` | 官方推荐的多步 tool-calling 抽象；Workers 完全兼容；前端配套 `@ai-sdk/react useChat` |
| ~~Agent 运行时（生产）~~ | ~~Cloudflare Containers~~ | ⚠️ M2+ deferred — 见 §0.1 |
| ~~Agent 运行时（本地）~~ | ~~Docker~~ | ⚠️ M2+ deferred — 见 §0.1，`sandbox/agent-base/` 保留作 spike 参考 |
| 模型路由 | AIHubMix（OpenAI 兼容路径 + Anthropic 原生路径）→ Claude Sonnet 4.5（Plan）/ Haiku 4.5（Edit/Suggestion）；图像走 `openai` SDK 调 gpt-image-2 | AIHubMix 已实测三条路径全通；gpt-image-2 不走 agent loop |
| 数据库 | Neon Postgres + Drizzle ORM | Workers 用 Neon HTTP serverless 驱动直读；container 内 Pi tool 出站调 Workers 内部 API（统一 SoT） |
| 对象存储 | R2 | CF 原生、零出口费用 |
| 队列 | Cloudflare Queues | 9 图生成 fan-out + reflect 异步触发 |
| 实时 | SSE（Workers）+ Durable Objects（fan-out） | DO 持有"container 流 ↔ 多个 SSE 客户端"的转发 |
| URL 抓取 | `@mozilla/readability` + 自研针对小红书 / 公众号 / 知乎 | 在 Workers 上跑 |

> ~~**本地 = 云端同构**：开发者本地 `docker run agent-base`；生产把同一镜像推到 Cloudflare Container Registry。Workers 端通过 `ContainerHandle` 抽象层切换本地 HTTP / 远端 DO container API，业务代码一份。~~ ⚠️ M2+ deferred — 见 §0.1

---

## 3. 高层架构

> ⚠️ **以下原图反映容器路径，已被 §0.1 修订为 Workers + AI SDK ToolLoopAgent**。M1 实际架构：
> - 客户端 → Workers (Hono) → ToolLoopAgent → AIHubMix → Anthropic/OpenAI
> - 客户端响应通过 `createAgentUIStreamResponse` 直出 AI SDK UI Stream（标准 SSE）
> - GenJob DO 仅做 9 图 fan-out 与 SSE 进度合并；不再有 AgentSession DO 持容器句柄
> - Tools 在 Workers 内闭包持 Drizzle handle 直写 Neon
>
> 原始图保留作历史参考：

```
┌──────────────────────────────────────────────────┐
│ Web (React + Vite, Cloudflare Pages)             │
└──────────────┬───────────────────────────────────┘
               │ HTTP + SSE
┌──────────────▼───────────────────────────────────┐
│ Hono on Cloudflare Workers (API)                 │
│  ┌──────────┬──────────┬─────────┬─────────┐    │
│  │ Project  │ Plan     │ Skills  │ Image   │    │
│  │ Service  │ Proxy    │ Service │ Service │    │
│  └──────────┴──────────┴─────────┴─────────┘    │
│  ┌──────────┬──────────┬─────────────────────┐  │
│  │ Edit     │ Suggest  │ Export / ChangeLog  │  │
│  │ Proxy    │ Proxy    │                     │  │
│  └──────────┴──────────┴─────────────────────┘  │
└─┬────────┬───────┬─────────────────────┬────────┘
  │        │       │                     │
  │        ▼       │                     │
  │   Durable Objects                    │
  │   ┌──────────────────────────────┐   │
  │   │ AgentSession DO              │ ◀── 管理 container 实例 + 客户端 SSE 列表
  │   │ GenJob DO                    │ ◀── 9 图 fan-out
  │   └──────────────┬───────────────┘   │
  │                  │                   │
  │                  ▼                   │
  │  ┌───────────────────────────────┐   │
  │  │ Cloudflare Container          │   │
  │  │  (image: agent-base)          │   │
  │  │  Node 20 + Pi Coding Agent    │   │
│  │   · agent-server (HTTP/SSE)   │   │
  │  │   · custom tools              │   │
  │  │   · skills (Markdown)         │   │
  │  │   · ModelRegistry → Claude    │   │
  │  └───────────────────────────────┘   │
  │                  │                   │
  ▼                  ▼                   ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│ Neon PG  │  │ CF Queues    │  │ R2 / KV      │
└──────────┘  └──────────────┘  └──────────────┘
```

**通信模式**：

- Workers ↔ AgentSession DO：Workers 内置 RPC
- DO ↔ Container：CF Containers 由 DO 直接持有 container 实例句柄；M1 用 **HTTP/SSE**（统一外部与内部流式协议，便于 Workers 代理与本地 curl 调试）
- Container 内 agent → Anthropic / OpenAI：直连出站
- 客户端 ↔ Workers：SSE，DO 透传或 fan-out container SSE 事件推前端

---

## 4. Container 生命周期与池化

> ⚠️ **整段 M2+ deferred — 见 §0.1 修订**。M1 不跑容器；以下内容保留作 M2+ 重新引入容器时的设计参考。

| 场景 | 时长 | 策略 |
|---|---|---|
| Plan（30s-2min） | 中 | 每个 Project 一个 container（AgentSession DO 持有），完成后保留 30 分钟（CF Container sleep）；用户回到 Project 命中 resume |
| ⌘K Edit（< 5s） | 短 | 共享 **预热池** N=5 常驻 container（独立 DO 群管理），按需 borrow/return |
| Suggestion reflect（异步，< 10s） | 短 | 同上预热池 |

### `agent-base` 镜像

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm i -g @mariozechner/pi-coding-agent
COPY skills/ /app/skills/         # M1 三个 Markdown Skill
COPY agent-server.ts /app/
COPY tools/ /app/tools/           # 自定义业务 tools
RUN npm i @mariozechner/pi-coding-agent tsx typescript
EXPOSE 7000
CMD ["npm", "run", "start"]
```

### 降级路径

- **本地**：`docker run -p 7000:7000 agent-base`，Workers `wrangler dev` 用环境变量切到 `http://localhost:7000`
- **云端**：DO 通过 CF Container API 启动同名镜像，自动获得 container handle

---

## 5. 模块设计

### 5.1 Project Service（CRUD，无 agent）

- **实体**：`Project`、`Card`
- **API**：
  - `POST /projects` — 创建
  - `GET /projects/:id`
  - `PATCH /projects/:id/cards/:cardId` — 部分更新，乐观锁（version 列）
  - `PATCH /projects/:id/cards` — 拖拽重排（批量 order 数组）
- 写动作必走 **ChangeLog**（见 5.8）

### 5.2 Plan Agent（Workers · ToolLoopAgent）

> M1 修订：Workers 内直接跑 ToolLoopAgent，不再走容器。MVP-1 已落地（`apps/api/src/agent/plan-agent.ts`）。

- **模型**：Claude Sonnet 4.5（通过 AIHubMix `/anthropic`）
- **API**：`POST /projects/:id/plan` → AI SDK UI Stream（标准 SSE，前端 `useChat` 直接吃）
- **核心代码形态**：
  ```ts
  const agent = new ToolLoopAgent({
    model: anthropic('claude-sonnet-4-5'),
    instructions: SYSTEM_PROMPT + buildSkillsPrompt(skillIds),
    tools: { create_card: createCardTool({ db, projectId }), ... },
    stopWhen: stepCountIs(20),
  });
  return createAgentUIStreamResponse({
    agent,
    uiMessages: buildInitialPlanMessages(topic),
    abortSignal: c.req.raw.signal,
  });
  ```
- **流程**：
  1. 读 project，按需 update `skillIds`，清空旧 cards（restart-friendly），status → `'planning'`
  2. 构造 ToolLoopAgent + 初始 user message（包含 topic）
  3. `createAgentUIStreamResponse` 直返 Response，AI SDK 内部驱动 tool loop：每步模型→tool calls→Workers 跑 tool execute→把 tool 结果回灌 → 模型继续，直到无 tool call 或 `stepCountIs(20)`
  4. 客户端 abort（关闭 EventSource）→ `c.req.raw.signal` → AI SDK 取消上游 fetch
- **Tools**（execute 闭包持 `{ db, projectId }`，写库 + ChangeLog）：
  - `create_card(index, role, title, body)` ← MVP-1 已实装
  - `update_card(cardId, patch)`（MVP-1 后跟进）
  - `reorder_cards(orderArray)`（MVP-1 后跟进）
  - `propose_suggestion(...)` 由 Suggestion Service 反射阶段触发，不在 Plan tool 集合里
- **多 turn followUp**（用户改 Plan）：客户端把已有 `uiMessages` 历史 + 新 user message 一并 POST 回来；ToolLoopAgent 接续上下文继续跑。无需服务端持久化对话。
- ~~AgentSession DO~~ ⚠️ 不再需要（M2+ 才会重新引入做容器句柄管理）

### 5.3 Skills Service

- **M1 数据**：3 个内置 Skill，单一表示：
  - **`skills` 表行**（DB 持久 + Web UI 元数据）—— `apps/api/src/app.ts` `seedOfficialSkills()` 启动时 upsert
  - 每条 row 的 `systemPrompt` 字段就是注入 ToolLoopAgent `instructions` 的源——不再需要单独的 Markdown 文件
- **Schema**：沿用 PRD § 08 v1
- **叠加策略**（Workers 侧拼装后注入 ToolLoopAgent `instructions`）：
  - `Project.skillIds` 数组顺序 = 优先级（idx 0 最高）
  - System prompt 拼接：`[base] + skill[0].systemPrompt + ... + skill[n].systemPrompt`
  - 冲突字段（如 `maxWordsPerCard`）以高优先级为准
  - `imageRefs` 取并集
  - `appliesTo.stages` 决定 Skill 注入到 plan / edit / image_prompt 哪些阶段
- **API**：`GET /skills`、`POST /projects/:id/skills`、`DELETE /projects/:id/skills/:id`、`PATCH /projects/:id/skills`（重排）

### 5.4 Image Service（不走 agent · 不走 container）

> MVP-2 已落地（producer + consumer + R2 + opt-in real test），SSE 进度推送延后到 GenJob DO 真实化。

- **模型**：gpt-image-2，Workers 内通过 AIHubMix `/v1` 走 `openai` SDK
- **实测延迟**（2026-05-04，AIHubMix 通路）：**单图 p50 ≈ 228s（gpt-image-2）**，gpt-image-1 ≈ 40s 作为对照
- **架构硬约束**：Workers 单请求 30s CPU / 5min wall 上限——9 图同步在 Worker 内不可能。**Queue + GenJob DO fan-out 是必需路径**
- **实体**：`GenJob`、`CardImage`
- **代码落点**：
  - `apps/api/src/image/gen-image.ts`：构造 prompt + 调 `images.generate({ model: 'gpt-image-2' })`；`ImageClient` 接口让测试注入 mock
  - `apps/api/src/image/store-image.ts`：R2 上传 + `CardImage` 行 + ChangeLog；R2 key 约定 `card-images/{genJobId}/{cardId}-v{n}.png`
  - `apps/api/src/queues/gen-image-consumer.ts`：`processGenImageMessage`（纯函数）+ `handleQueueBatch`（Workers queue 适配）
  - `apps/api/src/worker.ts`：`export default { fetch, queue: handleQueueBatch }`
- **流程（整组生成）**：
  1. `POST /projects/:id/gen-jobs` → 创建 `GenJob` (status=running) + `queue.sendBatch` N 条消息 → 202 `{ job, queued: N }`
  2. project status → `'generating'`
  3. Queue consumer (`max_concurrency=3`) 处理每条消息：调 gpt-image-2 → 上传 R2 → 写 `CardImage` + 更新 `card.imageVersionId` + 写 ChangeLog
  4. 每条处理完调用 `maybeMarkJobDone`：当 project 所有 card 都拿到 image 时，`GenJob.status='done'`
  5. 客户端通过 `GET /gen-jobs/:id/status` 轮询（MVP-2 暂不做 SSE 推送；GenJob DO 仍是 skeleton）
  6. **不做 OCR 校验**：失败由用户在编辑器点"重新生成此卡"触发
- **超时策略**：Queue consumer 单条消息 `timeout = 6min`（覆盖 gpt-image-2 p95），超时由 wrangler.toml `max_retries=2` 重试，最终入 DLQ `gen-image-jobs-dlq`
- **R2 URL 约定**：`CardImage.url` 字段当前存 R2 **key**（不是完整 URL）。前端访问需经 Worker `GET /images/*` 反向代理或配置 R2 公开域名——两者都延后实装
- **Prompt 拼接**（实装）：`小红书 4:5 卡片 + 主题 + 主体锚点 + 锁定项 + 画面风格 + 文字布局 + 第N张/角色 + 烧入标题 + 正文`（`buildImagePrompt` in `gen-image.ts`）
- **缓存键**（设计未实装）：`hash(project_id, card_index, full_prompt)` → `image_url` 存 Workers KV
- **单卡重生 / 蒙版**：单条 Queue 消息，复用流程（key 用 `-v2.png` 递增）
- **可选分级**（M1 待评估）：`gpt-image-1`（40s，便宜）作为预览模式，`gpt-image-2`（4min，高质量）作为最终模式

### 5.5 Edit Agent（Workers · ToolLoopAgent · ⌘K）

> M1 修订：Workers 内直接 ToolLoopAgent，不走容器池。形态与 §5.2 同。

- **模型**：Haiku 4.5（首字符 < 1.2s；通过 AIHubMix `/anthropic`）
- **API**：`POST /cards/:id/edit` → AI SDK UI Stream
- **流程**：
  1. 构造 ToolLoopAgent，instructions 包含 `currentField` / `currentValue` / `contextCards`，user message 是 instruction
  2. 单一 tool：`propose_edit(field, newValue, rationale)` — execute 不落库，**只返回 diff**（execute return 值进 stream，前端从 stream 拿到 diff）
  3. 用户 confirm → 客户端调 `PATCH /cards/:id`（version 乐观锁 + ChangeLog）；cancel 不动
- 三种入口（自由 NLU / 一键候选 / 模板指令）共用同一 endpoint，前端拼好 instruction
- ~~预热 container 池~~ ⚠️ 不需要：Workers 冷启就足够命中 < 1.2s

### 5.6 Suggestion Service（Workers · ToolLoopAgent · 异步）

> M1 修订：reflect agent 跑在 Queue consumer Worker 内，不再借容器池。

- **模型**：Haiku 4.5（通过 AIHubMix `/anthropic`）
- **触发**：编辑 / 重排 / 重生 后，Workers 推消息到 `suggestion-reflect` Queue；consumer Worker 收到消息后构造 ToolLoopAgent 跑一轮（无流式回客户端，直接写 Suggestion 表）
- **类型**：`structure` / `platform_sop` / `quality`（Visual System 黄/蓝/紫）
- **工具**：`read_project` / `read_card` / `propose_suggestion`
- **实体**：`Suggestion { id, projectId, cardId?, type, message, actionLabel, actionPayload, status, createdAt }`
- **降权**：忽略 N=3 次后该类静默；`(userId, suggestionType)` 维度记 `ignored_count`
- **API**：`GET /projects/:id/suggestions`、`POST /suggestions/:id/accept`、`POST /suggestions/:id/ignore`

### 5.7 Export Service

- **API**：`POST /projects/:id/export` → 异步任务 → R2 signed URL
- **内容**：高清 PNG（原尺寸）+ 压缩 PNG，按 `01_cover.png` 命名打 ZIP

### 5.8 ChangeLog（撤回基石）

PRD § 12 强约束：Agent 改动 100% 可逆。

- **实体**：`ChangeLog { id, projectId, actor: 'user'|'agent', target, targetId, action, before, after, createdAt }`
- 所有 Pi tool 的 write 路径必须 Workers 侧先写 ChangeLog 再写业务表（事务）
- **API**：`POST /changes/:id/undo`
- **撤回链**：连续撤 N 步，冲突时停在最近一次手动写入

---

## 6. 核心数据模型

落到 `packages/shared-types/`，前端 / Workers / container 内的 Pi tools 共享单一数据源。

```typescript
type Platform = 'redbook' | 'greenbook';
type CardRole = 'cover' | 'hook' | 'argument' | 'list' | 'payoff' | 'cta';

interface Project {
  id: string;
  userId: string;
  platform: Platform;            // M1 仅 redbook
  topic: string;
  cardCount: number;             // 默认 9
  aspectRatio: '4:5' | '1:1';
  language: 'zh' | 'en';
  tone: string;
  skillIds: string[];            // 顺序即优先级
  status: 'draft' | 'planning' | 'generating' | 'editing' | 'exported';
  createdAt: Date;
  updatedAt: Date;
}

interface Card {
  id: string;
  projectId: string;
  index: number;
  role: CardRole;
  title: string;
  body: string;
  imageVersionId: string | null;
  userEdited: boolean;
  locked: boolean;
  version: number;
}

interface Skill {
  id: string;
  name: string;
  author: string;
  category: string[];
  systemPrompt: string;
  fewShotExamples: { input: string; output: string }[];
  imageRefs: string[];
  outputSchema: {
    mustHave?: CardRole[];
    maxWordsPerCard?: number;
    titleEmojiProb?: number;
  };
  appliesTo: { platforms: Platform[]; stages: ('plan'|'edit'|'image_prompt')[] };
  isOfficial: boolean;
}

interface GenJob {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'partial' | 'done' | 'failed';
  mainSubject: { description: string; refImages: string[]; locks: ('lighting'|'camera'|'people'|'props')[] };
  artStyle: string;
  textLayout: 'top' | 'calligraphy' | 'fullscreen' | 'caption';
  startedAt: Date;
  completedAt: Date | null;
}

interface CardImage {
  id: string;
  cardId: string;
  genJobId: string;
  version: number;
  url: string;
  fullPrompt: string;
  createdAt: Date;
}

interface Suggestion {
  id: string;
  projectId: string;
  cardId: string | null;
  type: 'structure' | 'platform_sop' | 'quality';
  message: string;
  actionLabel: string;
  actionPayload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'ignored';
  createdAt: Date;
}

interface ChangeLog {
  id: string;
  projectId: string;
  actor: 'user' | 'agent';
  target: 'card' | 'project' | 'image';
  targetId: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}
```

---

## 7. 关键流程

### 7.1 Plan 流式生成

```
Web ──POST /projects/:id/plan──▶ Hono Worker
                                    │ → AgentSession DO (per project)
                                    │
                                    │ DO: ensure container(projectId)
                                    │   ├─ 命中：复用（resume from sleep）
                                    │   └─ 未命中：CF Containers API 启动 agent-base
                                    │
                                    │ DO ──HTTP POST /plan──▶ Container
                                    │            { cmd: 'plan', topic, skills }
                                    │
                                    │            Container 内 Pi agent
                                    │            ├─ 加载 Skill Markdown
                                    │            ├─ Pi.subscribe()
                                    │            └─ Claude 4.5 Sonnet
                                    │
                                    │ Container ──SSE──▶ DO
                                    │   event: card
                                    │   event: suggestion
                                    │   event: done
                                    │
                                    │ DO ──Workers fetch──▶ Project Service
                                    │   POST /internal/cards (落 ChangeLog + DB)
                                    │
Web ◀── SSE ─────────────────────── │
   event: card | suggestion | done
```

### 7.2 9 图生成（Queue + DO fan-out · 不走 container）

```
POST /gen-jobs ─▶ GenJob(queued) + 9 条 CF Queue 消息
                                       │
                  CF Queue (max_concurrency=3)
                                       │
                                       ▼ × 3 并发
                                  gpt-image-2 (openai SDK · in Workers)
                                       │
                                       ▼
                                  R2 上传 + CardImage 落库
                                       │
                                       ▼
                                GenJob DO ◀── 完成通知
                                       │
                                       ▼
                                SSE: card_image_done (per card)
```

### 7.3 ⌘K 改写

```
Web ──POST /cards/:id/edit──▶ Worker
                                    │ borrow container from pool
                                    │ HTTP/SSE: { cmd: 'edit', ... }
                                    │
                                    ◀── token stream（首字符 < 1.2s）
                                    │ tool_call: propose_edit(field, newValue, rationale)
                                    ◀── event: diff
Web ──user confirm──▶ PATCH /cards/:id
                              │
                              ▼
                          ChangeLog + 更新 cards
                              │
                              ▼
                          container return pool
```

### 7.4 撤回

```
POST /changes/:id/undo
  → 取 ChangeLog.before
  → 反向写业务表（事务）
  → 写一条新 ChangeLog（actor=user, action="undo:<原 action>"）
```

---

## 8. M1 实施分阶段

### 阶段 0 · Docker 本地 spike（**1 周，先行**）

**目的**：把 Pi agent + Anthropic + 自定义 tools 这条链路用 Docker 跑通。

- `npm i @mariozechner/pi-coding-agent`
- 写 `sandbox/agent-base/`：
  - `Dockerfile`
  - `agent-server.ts`：监听 HTTP POST，把 Pi `subscribe()` 转发成 SSE
  - `tools/`：3-4 个最小 tool（`create_card` 写到本地 JSON / `propose_suggestion` log）
- `docker build -t agent-base .` → `docker run -p 7000:7000 agent-base`
- 用 `curl -N` 或 `host-driver.ts`：POST `/plan` 发 `{cmd:'plan', topic, skills}`、打印 SSE 事件流
- 跑通最小 demo：输入"周末 200 块在胡同吃到撑" → 流式生成 3 张卡片 + 1 条 suggestion

**必过 checklist**：

- [ ] Docker 容器能装 `@mariozechner/pi-coding-agent` 并启动
- [ ] Container 出站能调通 Anthropic API
- [ ] HTTP/SSE 端口暴露、host 能连
- [ ] Pi 流式事件完整跨 SSE，无丢字
- [ ] Pi 自定义 tool 能被 agent 调用且返回值正常
- [ ] Pi sessions 持久化（用自定义 ResourceLoader 写到容器卷 / 后期切到 Neon+R2）

**产出**：`sandbox/agent-base/` 可运行 Docker 镜像 + `spike-report.md` 列出已验证 / 风险点。

### 阶段 1 · 单机贯通（2 周）

- `apps/api`（Hono）跑在本机 `wrangler dev`；`apps/web` `vite dev`
- AgentSession DO 通过环境变量切 `localhost:7000` 直连本机 Docker container
- Neon dev DB；R2 用 wrangler 的 R2 模拟
- 实现：Project / Plan / Skills（M1 三个内置）/ Image / ChangeLog
- 整条链路：建项目 → Plan 流式 → 9 图生成 → 看图 → 导出 ZIP

### 阶段 2 · ⌘K + Suggestion + 撤回（1.5 周）

- 实现 5.5 / 5.6 / 5.8
- 完整覆盖 PRD § 10 编辑器 + § 12 Agent 行为规范

### 阶段 3 · 部署到 Cloudflare（1.5 周）

- `apps/api` → Workers；`apps/web` → Pages
- `agent-base` 镜像 push 到 Cloudflare Container Registry
- AgentSession DO 切到 CF Containers API 启动 container
- 内测灰度 + 监控搭建（Cloudflare Analytics + 自建 dashboard）

**总计**：约 6 周

---

## 9. 验证策略

对照 PRD 验收清单，每个 P0 验收都先确定测试形态再动手（CLAUDE.md「验证先行」）。

| 验收项 (PRD §) | 验证方式 |
|---|---|
| § 06 P0 选平台 → 参数自动调整（12 组合） | 前端 table-driven 单测 |
| § 06 P0 URL 抓取成功率 ≥ 85% | 50 条 fixture URL 数据集 + CI 跑 |
| § 07 P0 拖拽重排后 Agent 3s 内回写 | e2e 计时断言（miniflare 本地 + Docker container） |
| § 07 P0 撤回 100% 可逆 | 每种 Agent 动作单测 + ChangeLog 完整性测试 |
| § 09 P0 9 图主体一致 ≥ 4/5（盲评） | 内测人评 + 评分 dashboard |
| ~~§ 09 P0 中文 OCR ≥ 92%~~ | **改：每周抽 50 张图人工评分，准确率 ≥ 90%**（PRD 同步更新中） |
| § 09 P0 单图重生不影响其他 | 缓存命中单测 + e2e |
| § 10 P0 ⌘K 首字符 < 1.2s | p50/p95 上报 → Cloudflare Analytics |
| § 10 P0 Agent 建议采纳率 ≥ 30% | 埋点 + 周报 |
| **新增** container 冷启 < 2s（CF Containers resume） | benchmark 脚本 |
| **新增** Pi 流式事件跨 SSE 0 丢字 | 阶段 0 spike 必过 |
| **新增** 单图生成 p95 < 6min（gpt-image-2） | Queue consumer 实测打点；超时即记 partial |
| **新增** 整组 9 图生成 p95 < 15min | GenJob DO 完成时间打点 |
| **MVP-2** Image pipeline 正确性 | mocked 单测覆盖 producer + consumer 全路径（5 cases）；opt-in 1-image 真实 API 测试（`RUN_REAL_IMAGE_TEST=1`，约 $0.16/run） |

### 9.1 CI 自动化（GitHub Actions）

`.github/workflows/ci.yml`，`push: main` 与 `pull_request` 触发，两个并行 Job：

- **typecheck** — `npm ci` + `npm run typecheck`（覆盖所有 workspace）。无 secret 依赖，给出最快反馈。
- **test (vitest + Neon)** — 跑 `apps/api/test/**`，需要仓库 secret `DATABASE_URL_TEST`（Neon 专用测试分支）。步骤：drizzle-kit migrate（幂等）→ `npm test`。
  - 因测试间用 `TRUNCATE` 共享同一 Neon 分支，job 配 `concurrency: { group: ci-test, cancel-in-progress: false }` 跨运行串行。
  - fork PR 自动跳过（拿不到 secret）。

`apps/api/test/setup.ts` 同时支持本地（读 `~/.secrets/common.env`）与 CI（读 `process.env`），无需切换。

---

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| ~~Cloudflare Containers 仍在演进~~ | ⚠️ 已消除（M1 不用容器，见 §0.1） |
| ~~Pi 是个人项目，长期维护风险~~ | ⚠️ 已消除（M1 不用 Pi，见 §0.1） |
| ~~Pi sessions 默认本地存储~~ | ⚠️ 已消除（M1 用 ToolLoopAgent，会话历史直接由前端 `useChat` 持有，服务端无状态） |
| ~~Container 池预热成本~~ | ⚠️ 已消除 |
| ~~Pi 流式 JSON 解析容错~~ | ⚠️ 已消除（AI SDK 处理 stream 解析） |
| ~~Workers CPU 时间限~~ | ⚠️ 已确认非问题：`await fetch` 不计 CPU；Plan/Edit/Suggest 全部在 5min wall 内 |
| **AI SDK 6 仍在 0.x → 1.0 演进** | 锁版本 `^6.0.x`；CI 跑契约测试（mock model + 真 SDK）防破坏性升级 |
| **多 turn 历史 token 膨胀** | 客户端 `useChat` 历史无限增长 → 服务端做最大 N 轮裁剪；Anthropic prompt cache 命中率 |
| gpt-image-2 中文 ~90%，无 OCR 兜底 | 编辑器"重新生成此卡"按钮显眼；prompt 工程加强（位置 / 字号约束写进阶段 prompt） |
| 主体一致性脸部翻车 | M1 默认关闭 lock_people（PRD 已规定） |
| gpt-image-2 限频 | CF Queues `max_concurrency=3` + 指数退避；多账号轮询作为后置 |
| 撤回链失效 | 所有 Agent 写 tool 走 ChangeLog；e2e 覆盖每种动作 |
| 多 Skill 叠加 prompt 爆 token | 每个 Skill `systemPrompt` 限 800 token；超限截断尾部 + 监控告警 |
| Suggestion 噪声打扰用户 | 同会话最多 5 条（PRD § 12）+ 忽略 3 次降权 |

---

## 11. 里程碑映射

| 里程碑 | 内容 | 前向兼容关键 |
|---|---|---|
| **M1** (~6 周) | § 1 范围内的所有功能 | — |
| M2 | 小绿书 platform；Skill 自建 + 市场 CRUD；完整 Suggestion | `Project.platform` 已建模；Skill schema 支持市场字段 |
| M3 | OAuth 直发；跨平台改版 | 跨平台改版本质是新 GenJob，复用 Image Service |
| M4 | 公众号长图文 / 抖音 9:16 / 微博 | `aspectRatio` + `cardCount` 已参数化 |

---

## 12. 仓库结构（monorepo · pnpm workspaces）

```
VCard/
├── apps/
│   ├── web/                # 前端 → Cloudflare Pages
│   └── api/                # Hono on Workers (wrangler.toml)
│       ├── src/
│       │   ├── services/   # project / image / export / changelog
│       │   ├── proxies/    # plan / edit / suggestion 三个 container proxy
│       │   ├── do/         # AgentSession DO / GenJob DO
│       │   └── queues/     # Queue consumers
├── sandbox/
│   ├── agent-base/         # 同时给 Docker 本地 + CF Containers 用
│   │   ├── Dockerfile
│   │   ├── agent-server.ts # HTTP/SSE 服务，Pi 适配层
│   │   └── tools/          # 自定义 tools
│   └── host-driver/        # 本机 spike 脚本
├── packages/
│   ├── shared-types/       # Project / Card / Skill 等 TS 接口
│   ├── ai-prompts/         # Skill Markdown（M1 三个）+ 系统 prompt 模板
│   └── ui/                 # Visual System 组件库
├── design/                 # 现有 wireframe（保留只读）
├── docs/
│   └── tech-design.md      # 本文件
├── pnpm-workspace.yaml
└── wrangler.toml
```

---

## 13. 开放问题

- **PRD § 09 文字烧入校验**：原 "OCR ≥ 92%" 改为"人评抽样 ≥ 90%"，需 PRD 文件同步更新
- **M1 内置 3 个 Skill 的 prompt 文案**：需运营 / 文案合作给定式
- **用户体系**：Cloudflare Access / Clerk / 自建 magic link 三选一
- **CF Containers 计费 / 配额 / GA 状态**：阶段 3 启动前调研对齐
- **直发 OAuth 白名单**（M3 议题）：小红书 / 公众号开放接口需提前申请

---

## 修订记录

| 日期 | 变更 | 来源 |
|---|---|---|
| 2026-05-03 | 初稿 | Issue #1 |
| 2026-05-04 | § 5.4 加 gpt-image-2 实测延迟 228s/图 + 12min 整组 + 6min 超时；§ 9 增加单图/整组延迟验收线 | AIHubMix 实测 |
| 2026-05-04 | **§ 0.1 架构修订**：放弃 CF Containers + Pi SDK，改用 Workers + Vercel AI SDK `ToolLoopAgent`；§3 架构图前置 deferred 横幅；§4 整段 deferred；§5.2/5.3/5.5/5.6 流程重写；§10 风险表汰换 6 行 | MVP-1 落地 + 风险评估 |
| 2026-05-04 | **MVP-2 image pipeline**：§5.4 重写为 producer + consumer 实装；新增 §9 验收行（mocked + opt-in real-API 测试策略）；R2 key 约定 `card-images/{genJobId}/{cardId}-v{n}.png`；客户端轮询 `/gen-jobs/:id/status`，SSE 推送延后 | MVP-2 落地 |
