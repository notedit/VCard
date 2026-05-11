# vCard 技术方案

> 状态：当前实现方案 · 2026-05-05  
> 关联文档：[Design Context](../.impeccable.md) · [Web App](../apps/web/src/App.tsx) · [API](../apps/api/src/app.ts)

## 1. 目标

vCard 是面向资讯和知识分享场景的社媒卡片工作台。核心路径是：

1. 输入主题和生成参数
2. 生成或编辑卡片大纲
3. 定制主题、密度、尺寸和模式
4. 生成可预览的卡片渲染快照
5. 在工作台里选中单卡对话编辑并导出

当前目标是保持产品主流程可运行、可验证、可迭代。LLM 大纲、真实图像生成、发布平台和异步任务后续接入，但不提前把复杂基础设施放进主线。

## 2. 仓库边界

| 路径 | 责任 |
|---|---|
| `apps/web` | React + Vite 前端应用。提供 5 步工作台、卡片预览、对话编辑 UI |
| `apps/api` | Hono API。提供 deck/card/generate/chat/export 同步接口 |
| `packages/shared-types` | 前后端共享的领域类型 |
| `docs` | 当前技术方案、测试夹具和工程说明 |

旧设计目录已移除。旧 wireframe、旧设计规范和旧 M1 agent 规划不再作为实现依据。

## 3. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| Web | React 18 + Vite + TypeScript | 产品级前端体验，当前不依赖 UI 框架 |
| API | Hono | 同一 `app.fetch` 可运行在 Node dev server 与 Cloudflare Workers |
| DB | Neon Postgres + Drizzle ORM | 使用 `@neondatabase/serverless` HTTP driver |
| Workspace | npm workspaces | `apps/*`、`packages/*`、`sandbox/*` |

## 4. 领域模型

核心对象是 `deck`，不是旧的 `project`。

| 表 | 用途 |
|---|---|
| `decks` | 一套社媒卡片。保存 prompt、mode、卡片数、尺寸、语言、风格设置和状态 |
| `deck_cards` | deck 下的单张卡。保存标题、要点、版式、渲染快照、图片 prompt/url、锁定状态和 `version` |
| `generation_jobs` | 生成记录。当前同步完成，保留 status/result/error 以便后续异步化 |
| `chat_messages` | 对话编辑记录。可绑定整套 deck 或单张 card |
| `activity_logs` | 审计日志。记录创建、编辑、生成、导出等动作 |

乐观锁只在卡片更新上强制要求：`PATCH /decks/:id/cards/:cardId` 必须携带当前 `version`。

## 5. API 合同

基础：

- `GET /health`
- `GET /decks?userId=demo-user`
- `POST /decks`
- `GET /decks/:id`
- `PATCH /decks/:id`

大纲与卡片：

- `POST /decks/:id/outline`
- `POST /decks/:id/cards`
- `PATCH /decks/:id/cards/:cardId`
- `DELETE /decks/:id/cards/:cardId`
- `PATCH /decks/:id/cards/reorder`

生成、对话、导出：

- `POST /decks/:id/generate`
- `GET /decks/:id/generations`
- `POST /decks/:id/chat`
- `GET /decks/:id/chat`
- `POST /decks/:id/chat/apply`
- `POST /decks/:id/export`

## 6. 前端集成策略

`apps/web` 已经接入 API，每一步与后端的对应关系如下：

| 页面 | 触发 | 后端调用 |
|---|---|---|
| 输入 (PageInput) | "开始生成" | `POST /decks` （生成大纲，可能 5–15s） |
| 大纲 (PageOutline) | 编辑标题 / bullets / layout | `PATCH /decks/:id/cards/:cardId`（debounce 600ms，乐观锁 version） |
| 大纲 | 加 / 删 / 重排 | `POST /decks/:id/cards`、`DELETE /decks/:id/cards/:cardId`、`PATCH /decks/:id/cards/reorder` |
| 大纲 | "重新生成大纲" | `POST /decks/:id/outline` |
| 风格 (PageStyle) | mode / template / theme / density / lang / size / count | `PATCH /decks/:id`（debounce 700ms，统一在 `useDeckSettingsSync` hook 里走） |
| 生成 (PageLoading) | 进入页面 | `POST /decks/:id/generate`，返回的 snapshot 同步本地 |
| 工作台 (PageStudio) | 进入 | `GET /decks/:id/chat` 拉历史 |
| 工作台 | 发送消息 | `POST /decks/:id/chat`（actions 由后端 stub 给出） |
| 工作台 | 应用 action | `POST /decks/:id/chat/apply` |
| 工作台 | 直接编辑 | 经 PageStudio 的卡片调度器走 `PATCH /decks/:id/cards/:cardId` |
| 工作台 | 下载 | `POST /decks/:id/export`，把返回的 manifest 触发本地下载 |

前端集成层位置：

- `apps/web/src/lib/api.ts` —— `fetch` 封装 + `ApiError`，`API_BASE` 取自 `VITE_API_URL`（兼容 `VITE_API_BASE`）。
- `apps/web/src/lib/adapters.ts` —— 字段口径映射（lang ⇄ language、size ⇄ aspectRatio、card row ⇄ FrontendCard）。
- `apps/web/src/lib/state.ts` —— `AppState` 类型、`buildDeckUpdatePayload`、`snapshotToStatePatch`、`humanizeApiError`、`chatTargetLabel`，纯函数可单测。
- `apps/web/src/lib/user-id.ts` —— 客户端 UUID。

前端不应直接理解旧 API 概念，也不应引入 `project`、`skill`、`suggestion` 等旧命名。

## 7. 客户端身份

当前不接账号系统。`userId` 由前端首次访问时生成 UUID 并写入 `localStorage['vcard-user-id']`，所有 API 请求显式携带：

- `POST /decks` 请求体必须含 `userId` (UUID)。
- `GET /decks?userId=...` 必填。
- DB 列 `decks.user_id` 仍保留 `'demo-user'` 默认值作兜底，不依赖。

后续接入真实账号系统时，从 JWT / session 派发 `userId`，并补齐所有 handler 的 deck 归属断言（当前未做，仅适合可信 demo 环境）。

## 8. 现状与扩展点

### 已实现

- **图像生成（方案 A：数据库 + waitUntil 后台任务）**：`apps/api/src/image/gen-image.ts` + `apps/api/src/app.ts` 的异步 generate handler。
  - HTTP handler 写好 `generation_jobs.result.cardJobs[]`（每张 status=queued）后立即返回 202 + jobId，不阻塞响应。
  - 后台 `runImageJob` 通过 `runInBackground`（Workers 用 `ctx.waitUntil`，Node 用 fire-and-forget）以 `IMAGE_CONCURRENCY=3` 并发跑卡片。
  - 进度通过 `markCardJobStatus` 用 PostgreSQL `jsonb_set`/`jsonb_array_elements` **原子重写** `cardJobs` 数组，避免并发 read-modify-write 的 lost update。
  - `generateCardImage` 三条 provider 路径：优先 `AIHUBMIX_API_KEY`（baseURL `https://aihubmix.com/v1`，与 outline / chat 共用同一 key 与计费账户），其次 `OPENAI_API_KEY`（直连），都没有则返回 base64-encoded SVG data URL 占位（带渐变 + 卡片信息），方便端到端测试与本地开发。
  - 单卡失败不阻塞其它卡；job 最终 status 是 `done`（全部成功）或 `failed` + `error: 'partial_failure'`。
  - 前端 `PageLoading` 1.5s 轮询 `GET /decks/:id/generations/:jobId`，进度条实时反映完成数。
  - **测试钩子**：`flushBackgroundTasks()` 让测试可以等所有 in-flight 后台 promise 跑完。
- **LLM 大纲生成**：`apps/api/src/llm/outline.ts` 调用 `claude-sonnet-4-6`（via AIHubMix Anthropic-native baseURL `https://aihubmix.com`）。
  - 自定义 `web_search` 工具，execute 调用 Tavily Search API。
  - `AIHUBMIX_API_KEY` 缺失时，`POST /decks` 与 `POST /decks/:id/outline` 自动回退本地模板（带 warn 日志），保证开发与测试不被卡死。
  - `TAVILY_API_KEY` 缺失时，模型仍可生成大纲，仅失去时效性搜索能力。
  - 结构化输出：模型最后一条消息输出 JSON，服务端用 `extractJsonObject` + zod schema 解析校验。
- **LLM 对话编辑**：`apps/api/src/llm/chat.ts` 同样走 `claude-sonnet-4-6`。
  - 复用 `voice-tone` / `anti-slop` / `structural-rules` 三份 skill 作为 system prompt（与大纲生成同源）。
  - 输出 JSON `{ body, actions[] }`，actions kind 限定 `title | bullet | tone`，每种最多 1 条。
  - 缺 `AIHUBMIX_API_KEY` 或解析失败时回退到 `localChatReply` stub。
- **多卡组切换**：前端 TopNav `DeckPicker` 拉 `GET /decks?userId=`，可在不同卡组之间切换；切换时调 `GET /decks/:id` 全量同步。
- **草稿 hydration**：App mount 时若本地草稿带 `deckId`，先 `GET /decks/:id` 用后端 snapshot 校准本地（404 时清掉草稿）。

### 后续扩展点

- 平台发布：在 export 之后新增 publish job，不污染 deck/card 核心模型。
- 账号系统 + 多租户隔离：替换客户端 UUID 方案为真实鉴权，并在所有 handler 添加 `deck.userId` 归属断言。
- 流式 chat / outline：把同步 `generateText` 换成 `streamText`，前端边出边显示。

## 10. 上线前必做：图像生成迁到 Queue + Durable Object

当前方案 A 是**功能可用、可端到端验证**的最小实现，但**不能直接上生产**。Cloudflare Workers 单次请求的 wall-time 上限（付费版约 30 分钟，免费版 30s）会在以下场景失效：

| 触发条件 | 现象 |
|---|---|
| 单张 gpt-image-1 / gpt-image-2 跑 ~30s × 7 张串行 ≈ 3.5 min | 接近 wall-time 上限，单卡卡住整个 worker |
| 多用户同时点"生成" | Workers 没有 Queue 削峰，下游被打爆，rate-limit |
| Worker 中途被 Cloudflare 强杀 / 进程崩溃 | in-flight 卡片彻底丢失，没有自动重试 |
| 用户刷新页面 | 后台 fire-and-forget promise 还在跑，但用户切到别的 deck 后无法收到完成通知（需要轮询数据库） |

**触发时机：以下任一成立时启动改造**

- 接入真实 OpenAI 图像 API（不再用 SVG 占位），单卡延迟 > 10s。
- 实际用户量 > 10 个，或并发生成请求 > 3 个/分钟。
- 出现 in-flight job 因为 worker 被回收而永久 stuck 的报错。

**改造步骤**

1. **绑定 Cloudflare Queue + Durable Object + R2**：在 `apps/api/wrangler.toml` 加 `[[queues.producers]]` / `[[queues.consumers]]` / `[[durable_objects.bindings]]` / `[[r2_buckets]]`。
2. **新建 `apps/api/src/queues/gen-image-consumer.ts`**：Queue consumer，每条消息 = 一张卡的生成任务。Consumer 内部调 `generateCardImage`，结果上传 R2，写回 `deck_cards.image_url`，并 RPC 通知对应的 DO 更新进度。
3. **新建 `apps/api/src/do/gen-job.ts`**（Durable Object）：每个 `generationJob` 对应一个 DO 实例。负责：
   - 串行化 `cardJobs` 进度写入（替代当前 jsonb 原子 SQL，DO 内单线程更简单可靠）；
   - 对外提供 WebSocket / SSE 端点给前端订阅实时进度；
   - 全部完成时把 deck.status 从 `generating` 切到 `ready` 或 `styled`（partial）；
   - 用 `state.storage.setAlarm(...)` 做 1 小时超时清理（标记 stuck job 为 failed 让用户重发）。
4. **改 `app.ts` 的 generate handler**：image mode 时用 `env.GEN_IMAGE_QUEUE.sendBatch(...)` 替代 `runInBackground`，立即返回 202。整个 handler ≤ 1s。
5. **R2 替代 data URL**：`generateCardImage` 返回 base64 → R2 上传 → 写持久 URL。`deck_cards.image_url` 不再存巨量 base64。
6. **前端 `PageLoading`**：把 1.5s HTTP 轮询升级为 WebSocket / SSE，连到 DO 端点，事件驱动。

**估算**：1.5–2 天，主要在 wrangler binding 接通和 DO 状态机的边界条件。

**保留的迁移友好点**

- `generation_jobs.result.cardJobs[]` 数据结构与 DO 内部进度状态机一致，迁移时 DO 启动可从数据库 hydrate。
- `runInBackground` 已经把 Cloudflare 与 Node 路径解耦，迁到 Queue 时只需在 Cloudflare 路径换实现，Node 本地开发仍可用 fire-and-forget 跑通端到端。
- `generateCardImage` 的两条路径（OpenAI / 占位）保留，CI / 离线开发不依赖外部 API。

## 9. 验证

当前必须保持以下命令通过：

```bash
npm run typecheck
npm test
npm run build
```

测试覆盖：

- **API**（`apps/api/test`，59 个）：
  - `app.test.ts` —— deck 创建、卡片乐观锁、大纲替换、html / image 两条 generate 路径、聊天动作应用、导出 manifest。
  - `app.errors.test.ts` —— 健康检查、`GET /decks?userId=` 列表、404 / 400 / 409 错误路径、deck PATCH 合并、card 增删 / reorder / version 校验、chat apply 三种 action、generate 边界。
  - `llm-outline.test.ts` —— 大纲生成 + slop 过滤。
  - `chat.test.ts` —— LLM chat reply 解析、fence 处理、zod 校验、空 actions 拒绝。
  - `gen-image.test.ts` —— `composePrompt`、`buildPlaceholderDataUrl` 的 SVG 输出 / XML 转义 / 调色板差异、`generateCardImage` 占位回退。
  - `image-job.test.ts` —— 异步 image generate 端到端：202 立返、`GET /generations/:jobId` 进度查询、`flushBackgroundTasks` 后所有卡片有 imageUrl、按 cardIds 局部重生成。
- **Web**（`apps/web/src/lib`，36 个）：
  - `adapters.test.ts` —— 语言 / 比例 / card / settings 双向映射。
  - `api.test.ts` —— mock fetch 验证每个端点的 method / 路径 / 序列化和 ApiError 包装，含 `getGenerationJob`。
  - `state.test.ts` —— `buildDeckUpdatePayload`、`snapshotToStatePatch`、`chatTargetLabel`、`currentDeckTitle`、`computeImageJobProgress`、`humanizeApiError` 纯函数。
  - `integration.test.ts` —— `createDeck → snapshotToStatePatch → buildDeckUpdatePayload` 完整链路。
