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
| **API 层** | **Hono on Cloudflare Workers** | Workers Runtime 原生 / 极轻 / TS 一等公民。承担：路由、鉴权、CRUD、SSE 转发、container proxy。**不跑 agent loop** |
| **Agent 运行时（生产）** | **Cloudflare Containers**（由 Durable Object 持有 container 句柄） | 与 Workers 同栈、DO 原生管理 container 生命周期；适合长 agent loop（无 Workers 的 30s CPU 限） |
| **Agent 运行时（本地）** | **Docker**，同一镜像 | 本地用 Docker 跑同一份 `agent-base` 镜像，便于阶段 0 spike + 调试 |
| **Agent 框架** | **Pi Coding Agent SDK** (`@mariozechner/pi-coding-agent`) | 提供 agent loop / 自定义 tools / sessions / steering / Markdown skills 加载 |
| 模型 | Pi `ModelRegistry` 接 Claude 4.5 Sonnet + Haiku 4.5；图像走 `openai` SDK 调 gpt-image-2 | gpt-image-2 不走 agent，单纯生成调用 |
| 数据库 | Neon Postgres + Drizzle ORM | Workers 用 Neon HTTP serverless 驱动直读；container 内 Pi tool 出站调 Workers 内部 API（统一 SoT） |
| 对象存储 | R2 | CF 原生、零出口费用 |
| 队列 | Cloudflare Queues | 9 图生成 fan-out + reflect 异步触发 |
| 实时 | SSE（Workers）+ Durable Objects（fan-out） | DO 持有"container 流 ↔ 多个 SSE 客户端"的转发 |
| URL 抓取 | `@mozilla/readability` + 自研针对小红书 / 公众号 / 知乎 | 在 Workers 上跑 |

> **本地 = 云端同构**：开发者本地 `docker run agent-base`；生产把同一镜像推到 Cloudflare Container Registry。Workers 端通过 `ContainerHandle` 抽象层切换本地 HTTP / 远端 DO container API，业务代码一份。

---

## 3. 高层架构

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
  │  │   · agent-server (HTTP/ws)    │   │
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
- DO ↔ Container：CF Containers 由 DO 直接持有 container 实例句柄；M1 用 **WebSocket**（Pi 流式 token 密集，单连接最优）
- Container 内 agent → Anthropic / OpenAI：直连出站
- 客户端 ↔ Workers：SSE，DO 把 container ws 事件 fan-out 成 SSE 推前端

---

## 4. Container 生命周期与池化

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
RUN npm i ws @anthropic-ai/sdk
EXPOSE 7000
CMD ["node", "/app/agent-server.js"]
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

### 5.2 Plan Proxy（Workers）+ Plan Agent（Container）

- **模型**：Claude 4.5 Sonnet
- **API**：`POST /projects/:id/plan` → SSE
- **流程**：
  1. Workers 路由到 `AgentSession DO`（按 projectId 哈希）
  2. DO 检查是否已有活 container：无则启动新 container
  3. DO 通过 ws 向 container 发 `{cmd: 'plan', topic, platform, skillIds}`
  4. Container 内 Pi agent：
     - 加载挂载的 Skill Markdown（Pi `ResourceLoader`）
     - `Pi.subscribe()` 流式触发 Claude
     - 自定义 tools：
       - `create_card(index, role, title, body)`
       - `update_card(cardId, patch)` → container 出站调 Workers 内部 API → ChangeLog + DB
       - `reorder_cards(orderArray)` → 同上
       - `propose_suggestion(cardId, type, message, action)` → 写 Suggestion 表
       - `read_skill(id)` / `read_card(id)` → 读 DB
  5. Pi 流式事件 ws push 给 DO；DO fan-out SSE 给客户端
  6. **协议事件**：`event: card | strategy | suggestion | done | error`
- 用户改 Plan 时，Workers 把 `{cmd: 'followUp', ...}` 投给 container（Pi `followUp()`），让 agent 决定是否补建议

### 5.3 Skills Service

- **M1 数据**：3 个内置 Skill 双重表示：
  - **Markdown 文件**（bundled 进 `agent-base` 镜像 `/app/skills/*.md`）：给 Pi agent 用
  - **DB 元数据**（`skills` 表）：给 Web UI 用（名称、作者、标签、引用图）
- **Schema**：沿用 PRD § 08 v1
- **叠加策略**（Workers 侧拼装后随 `cmd: 'plan'` 一并发给 container）：
  - `Project.skillIds` 数组顺序 = 优先级（idx 0 最高）
  - System prompt 拼接：`[base] + skill[0].systemPrompt + ... + skill[n].systemPrompt`
  - 冲突字段（如 `maxWordsPerCard`）以高优先级为准
  - `imageRefs` 取并集
  - `appliesTo.stages` 决定 Skill 注入到 plan / edit / image_prompt 哪些阶段
- **API**：`GET /skills`、`POST /projects/:id/skills`、`DELETE /projects/:id/skills/:id`、`PATCH /projects/:id/skills`（重排）

### 5.4 Image Service（不走 agent · 不走 container）

- **模型**：gpt-image-2，Workers 内直接 `openai` SDK 调
- **实测延迟**（2026-05-04，AIHubMix 通路）：**单图 p50 ≈ 228s（gpt-image-2）**，gpt-image-1 ≈ 40s 作为对照
- **架构硬约束**：Workers 单请求 30s CPU / 5min wall 上限——9 图同步在 Worker 内串行/并行都不可能。**Queue + GenJob DO fan-out 是必需路径，不是优化项**
- **实体**：`GenJob`、`CardImage`
- **流程（整组生成）**：
  1. `POST /projects/:id/gen-jobs` 创建 GenJob，写入 CF Queue（9 条消息）
  2. 立即返回 jobId（status=queued）
  3. 创建 GenJob DO 作为 fan-out 中心
  4. Queue consumer Worker 处理消息（`max_concurrency: 3` 避限频）—— 3 并发 × 4min/图 × 9 图 ≈ **整组 12 分钟**
  5. 单图完成 → 上传 R2 → 写 `CardImage` → 通知 GenJob DO → DO push SSE `card_image_done`
  6. 9 图全成 → status=done；部分失败 → status=partial（保留成功）
  7. **不做 OCR 校验**：失败由用户在编辑器点"重新生成此卡"触发
- **超时策略**：Queue consumer 单条消息 `timeout = 6min`（覆盖 gpt-image-2 p95），超时记 partial 失败，不重排队
- **Prompt 拼接**：`[全局 prefix（主体锚点 + 锁定项）] + [Skill 风格 token] + [本卡角色 + 描述]`
- **缓存键**：`hash(project_id, card_index, full_prompt)` → `image_url` 存 Workers KV
- **单卡重生 / 蒙版**：单条 Queue 消息，复用流程
- **可选分级**（M1 待评估）：`gpt-image-1`（40s，便宜）作为预览模式，`gpt-image-2`（4min，高质量）作为最终模式，让用户在编辑器选

### 5.5 Edit Proxy + Edit Agent（Container · ⌘K）

- **模型**：Haiku 4.5（首字符 < 1.2s）
- **API**：`POST /cards/:id/edit` → SSE
- **流程**：
  1. Workers 从预热 container 池 borrow 一个
  2. ws 发 `{cmd: 'edit', cardId, instruction, currentField, currentValue, contextCards}`
  3. Pi agent 单轮，工具：
     - `propose_edit(field, newValue, rationale)` — **不直接落库**，把 diff 推回 Workers
  4. Workers SSE token stream → 客户端
  5. 完成时 push `event: diff`
  6. 用户 confirm → `PATCH /cards/:id`（version 乐观锁 + ChangeLog）；cancel 不动
  7. 完成后 container return 池子（不 stop，等下次 borrow）
- 三种入口（自由 NLU / 一键候选 / 模板指令）共用同一 endpoint，前端拼好 instruction

### 5.6 Suggestion Service（Pi reflect agent · 异步）

- **模型**：Haiku 4.5
- **触发**：编辑 / 重排 / 重生 后，Workers 推消息到 CF Queue；reflect consumer 借池子里的 container 做 reflect
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
                                    │ DO ──ws──▶ Container
                                    │            { cmd: 'plan', topic, skills }
                                    │
                                    │            Container 内 Pi agent
                                    │            ├─ 加载 Skill Markdown
                                    │            ├─ Pi.subscribe()
                                    │            └─ Claude 4.5 Sonnet
                                    │
                                    │ Container ──ws──▶ DO
                                    │   { type: 'tool_call', tool: 'create_card', ... }
                                    │   { type: 'tool_call', tool: 'propose_suggestion', ... }
                                    │   { type: 'done' }
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
                                    │ ws: { cmd: 'edit', ... }
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
  - `agent-server.ts`：监听 ws，把 Pi `subscribe()` 转发给 ws 客户端
  - `tools/`：3-4 个最小 tool（`create_card` 写到本地 JSON / `propose_suggestion` log）
- `docker build -t agent-base .` → `docker run -p 7000:7000 agent-base`
- 写 `host-driver.ts`（本机 Node 脚本）：连 ws、发 `{cmd:'plan', topic, skills}`、打印事件流
- 跑通最小 demo：输入"周末 200 块在胡同吃到撑" → 流式生成 3 张卡片 + 1 条 suggestion

**必过 checklist**：

- [ ] Docker 容器能装 `@mariozechner/pi-coding-agent` 并启动
- [ ] Container 出站能调通 Anthropic API
- [ ] ws 端口暴露、host 能连
- [ ] Pi 流式事件完整跨 ws，无丢字
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
| **新增** Pi 流式事件跨 ws 0 丢字 | 阶段 0 spike 必过 |
| **新增** 单图生成 p95 < 6min（gpt-image-2） | Queue consumer 实测打点；超时即记 partial |
| **新增** 整组 9 图生成 p95 < 15min | GenJob DO 完成时间打点 |

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
| **Cloudflare Containers 仍在演进**（生命周期 / 入站端口转发 / 计费可能变） | 阶段 0 用 Docker 验证业务逻辑，阶段 3 再对齐 CF Containers 当时的 API；保持业务代码与 container 启动方式解耦（`ContainerHandle` 抽象） |
| **Pi 是个人项目，长期维护风险** | vendoring 兜底：锁版本 + monorepo 镜像源码（`packages/pi-vendor`），最坏自己维护 |
| **Pi sessions 默认本地存储** | 自定义 `ResourceLoader`，把 sessions 持久化到 Neon（结构化）+ R2（消息体）；阶段 1 完成 |
| Container 池预热成本 | 灰度阶段 N=5；按 QPS 自动伸缩在阶段 3 加 |
| gpt-image-2 中文 ~90%，无 OCR 兜底 | 编辑器"重新生成此卡"按钮显眼；prompt 工程加强（位置 / 字号约束写进阶段 prompt） |
| 主体一致性脸部翻车 | M1 默认关闭 lock_people（PRD 已规定） |
| Pi 流式 JSON 解析容错 | Pi 自带 streaming + tool_call 协议；DO 持久化已写部分卡片，断流可恢复 |
| gpt-image-2 限频 | CF Queues `max_concurrency=3` + 指数退避；多账号轮询作为后置 |
| 撤回链失效 | 所有 Agent 写 tool 走 ChangeLog 事务；e2e 覆盖每种动作 |
| 多 Skill 叠加 prompt 爆 token | 每个 Skill `systemPrompt` 限 800 token；超限截断尾部 + 监控告警 |
| Suggestion 噪声打扰用户 | 同会话最多 5 条（PRD § 12）+ 忽略 3 次降权 |
| Workers CPU 时间限 | 长任务都在 container 内；Workers 只管 SSE 转发与 CRUD |

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
│   │   ├── agent-server.ts # ws 服务，Pi 适配层
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
