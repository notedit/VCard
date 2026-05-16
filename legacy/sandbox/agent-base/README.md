# agent-base (M1 阶段 0)

本目录提供 Docker 本地 spike 所需最小实现：
- `Dockerfile`
- `agent-server.ts`（ws 入口）
- `tools/`（create_card/propose_suggestion 占位）

> 该实现用于验证容器通信、流式事件与 tool 调用路径；生产版将接入 Cloudflare Containers + DO。
