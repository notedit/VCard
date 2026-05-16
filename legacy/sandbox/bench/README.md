# sandbox/bench

性能基线 / 回归脚本。本地跑，输出对照 tech-design.md §9 的 SLO。

## cold-start.mjs

测 `agent-base` 容器从 `docker run` 到 ws 端口可用的延迟。

```bash
# 一次性打镜像
cd sandbox/agent-base && docker build -t agent-base .

# 跑 10 次取均值
node sandbox/bench/cold-start.mjs

# 自定义参数
N=20 PORT=7001 node sandbox/bench/cold-start.mjs
```

输出示例：

```
run  1: ready in 1240 ms
run  2: ready in 980 ms
...
samples:  10/10
min/max:  890 / 1480 ms
mean:     1080 ms
p50:      1050 ms
p95:      1420 ms
```

**注意**：本地 Docker 数值不能直接对标 CF Containers——镜像拉取、Workers 路径、DO 句柄获取这些云端因素本地都没有。本指标用于：

1. 回归保护：镜像/依赖变更后 cold-start 不应显著退化
2. 给出量级感：本地 ~1s 时云端通常 1.5-2.5x

CF Containers 真实冷启 < 2s 这条 SLO 要等阶段 3 部署后用 `wrangler tail` + 自打点验证。
