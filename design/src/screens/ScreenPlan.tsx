import { G, Sticky } from '../components/WfBits';

export function ScreenPlan() {
  const W = 920;
  const H = 760;
  const cards = [
    { n: 1, role: '封面 · Hook', title: '200 块吃到扶墙出', sub: '一句话钩子 + 大字 + 真人摄影', color: 'var(--accent)' },
    { n: 2, role: '立论', title: '胡同小馆 ≠ 网红店', sub: '解释为何 200 块能吃到撑', color: '#e8a23c' },
    { n: 3, role: '清单 · 1', title: '#01 老金涮肉 · 38￥', sub: '地址 / 招牌 / 避雷', color: '#1a1a1a' },
    { n: 4, role: '清单 · 2', title: '#02 馅老满 · 22￥', sub: '地址 / 招牌 / 避雷', color: '#1a1a1a' },
    { n: 5, role: '清单 · 3-7', title: '其余 5 家速览', sub: '卡片密度更高 · 双栏', color: '#1a1a1a' },
    { n: 6, role: '转折 · Payoff', title: '其实最贵的不是钱', sub: '情绪卡 · 大字 + 留白', color: 'var(--accent-3)' },
    { n: 7, role: 'CTA · 收藏', title: '点收藏 · 评论留你的爱店', sub: '转化卡 · 引导互动', color: 'var(--accent-2)' },
  ];
  return (
    <div style={{ width: W, height: H, padding: '24px 28px', background: 'var(--paper)', position: 'relative' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="disp" style={{ fontSize: 24 }}>Plan</div>
          <span className="tag">7 张卡 · 小红书 4:5</span>
          <span className="pill">{G.brain} 小红书种草体 · 已挂载</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip">{G.refresh} 重新策划</span>
          <div className="btn primary">下一步 · 选风格 →</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, height: H - 90 }}>
        <div style={{ overflow: 'hidden', position: 'relative' }}>
          <div className="hand muted" style={{ fontSize: 13, marginBottom: 8 }}>
            ← 拖拽重排 · 点卡片改写 · 右键拆/合并
          </div>
          <div className="col" style={{ gap: 8 }}>
            {cards.map((c, i) => (
              <div
                key={i}
                className="wf wf-tight"
                style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}
              >
                <span style={{ opacity: 0.4 }}>{G.drag}</span>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    border: '1.4px solid var(--line)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: c.color,
                    color: '#fff',
                    fontFamily: 'var(--font-disp)',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {c.n}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="tag" style={{ borderColor: c.color, color: c.color }}>{c.role}</span>
                    {i === 2 && <span className="tag" style={{ background: 'var(--hi)' }}>用户改过</span>}
                  </div>
                  <div className="hand" style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{c.title}</div>
                  <div className="mono muted" style={{ marginTop: 2 }}>{c.sub}</div>
                </div>
                <div className="row" style={{ gap: 4, opacity: 0.7 }}>
                  <span className="tag">{G.edit}</span>
                  <span className="tag">{G.spark} 改写</span>
                  <span className="tag">⋯</span>
                </div>
              </div>
            ))}
            <div
              className="wf wf-tight"
              style={{
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                borderStyle: 'dashed',
                boxShadow: 'none',
              }}
            >
              <span className="hand muted">{G.plus} 追加卡片 ·</span>
              <span className="hand">让 AI 在 #5 后插入「番外：胡同夜景」</span>
            </div>
          </div>
        </div>

        <div className="wf" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            className="row"
            style={{ padding: '10px 12px', borderBottom: '1.4px solid var(--line)', justifyContent: 'space-between' }}
          >
            <div className="row" style={{ gap: 6 }}>
              {G.brain}
              <b className="hand">Plan Agent</b>
            </div>
            <span className="mono muted">claude-haiku</span>
          </div>
          <div style={{ flex: 1, padding: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Sticky color="g" style={{ transform: 'none' }}>
              <b>策略说明</b>
              <br />
              小红书爆款=钩子+清单+情绪。我先放价格锚点钩子，再拆 7 家成可滑动清单，最后用一个 emotional payoff 把帖子升华。
            </Sticky>
            <div
              className="hand"
              style={{
                fontSize: 13,
                alignSelf: 'flex-end',
                maxWidth: '80%',
                background: 'var(--ink)',
                color: '#fff',
                borderRadius: '10px 10px 2px 10px',
                padding: '7px 10px',
              }}
            >
              第 3 家改成"老金涮肉"，38 块那家
            </div>
            <div
              className="hand"
              style={{
                fontSize: 13,
                maxWidth: '90%',
                background: '#fff',
                border: '1.4px solid var(--line)',
                borderRadius: '10px 10px 10px 2px',
                padding: '7px 10px',
                boxShadow: '1.5px 1.5px 0 var(--line)',
              }}
            >
              改好了。同时在 #2 的"立论"加了一句"老北京铜锅"——和 #3 形成呼应。要保留吗？{' '}
              <span className="tag" style={{ marginLeft: 4 }}>保留</span> <span className="tag">撤回</span>
            </div>
            <div
              className="hand"
              style={{
                fontSize: 13,
                maxWidth: '90%',
                background: '#fff',
                border: '1.4px solid var(--line)',
                borderRadius: '10px 10px 10px 2px',
                padding: '7px 10px',
                boxShadow: '1.5px 1.5px 0 var(--line)',
              }}
            >
              建议：第 5 张信息密度高，分成 5a / 5b？
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <span className="chip dark">采纳</span>
                <span className="chip">忽略</span>
              </div>
            </div>
          </div>
          <div className="row" style={{ padding: 10, borderTop: '1.4px solid var(--line)', gap: 6 }}>
            <div className="input grow" style={{ padding: '6px 10px' }}>
              <span className="muted">告诉 Agent 怎么改…</span>
            </div>
            <span className="chip">{G.send}</span>
          </div>
        </div>
      </div>

      <Sticky color="b" style={{ position: 'absolute', right: -18, top: 340, width: 180 }}>
        <b>差异化 #2</b>
        <br />
        每张卡都有"叙事角色"标签——把爆款结构显式化，新人看着学，老手快速调
      </Sticky>
    </div>
  );
}
