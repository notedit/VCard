# M1 测试依赖资源清单

## 1) 运行时与基础设施
- Node.js 20+
- npm 10+
- Docker（用于 `sandbox/agent-base`）
- Cloudflare Wrangler（本地 Worker/DO/R2 模拟）

## 2) 外部服务与凭据
- Anthropic API Key（Plan / Edit / Suggestion）
- OpenAI API Key（gpt-image-2）
- Neon Postgres（dev/test 库）
- Cloudflare R2 Bucket（图片对象）
- Cloudflare Queues（9 图 fan-out、reflect 异步）
- （部署阶段）Cloudflare Containers Registry 访问权限

## 3) 测试数据集
- URL 抓取 fixture（>=50 条，覆盖小红书/公众号/知乎）
- Plan 主题语料（>=30 条，覆盖餐饮/旅游/学习/职场）
- 图像一致性盲评样本（每周 50 组 * 9 图）
- 中文文字可读性人工抽样（每周 50 张）

## 4) 性能与可观测
- SSE 流式日志采样（token 首字延迟）
- Container 冷启 benchmark 脚本
- Suggestion 采纳率埋点看板
- ChangeLog 可逆性回放脚本
