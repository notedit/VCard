import { G, Platform, Sticky, Underline } from '../components/WfBits';

export type EntryVariant = 'A' | 'B';

export function ScreenEntry({ variant = 'A' }: { variant?: EntryVariant }) {
  const W = 920;
  const H = 700;
  const platforms = [
    { k: 'redbook' as const, name: '小红书', hint: '4:5 · 多图笔记', sel: variant === 'A', soon: false },
    { k: 'greenbook' as const, name: '小绿书', hint: '公众号封面图', sel: variant === 'B', soon: false },
    { k: 'wechat' as const, name: '公众号', hint: '图文长文', soon: true, sel: false },
    { k: 'douyin' as const, name: '抖音/快手', hint: '9:16 故事', soon: true, sel: false },
    { k: 'weibo' as const, name: '微博', hint: '图文 / 长图', soon: true, sel: false },
  ];
  return (
    <div style={{ width: W, height: H, padding: '28px 36px', background: 'var(--paper)', position: 'relative' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="disp" style={{ fontSize: 22 }}>卡片</div>
          <span className="tag">社媒 Studio</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill">{G.brain}<span>我的 Skills · 6</span></span>
          <span className="pill">{G.user}<span>历史草稿</span></span>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div className="disp" style={{ fontSize: 54, lineHeight: 1 }}>
          今天想发到{' '}
          <span style={{ position: 'relative' }}>
            哪里
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: -6 }}>
              <Underline w={120} />
            </span>
          </span>
          ?
        </div>
        <div className="hand muted" style={{ fontSize: 15, marginTop: 14 }}>
          先选平台，我们按平台的"游戏规则"为你 Plan —— 字数、尺寸、爆款结构、视觉语言都不一样
        </div>
      </div>

      <div className="row" style={{ gap: 14, justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        {platforms.map((p, i) => (
          <div
            key={i}
            className={`wf wf-tight ${p.sel ? 'focus-shadow' : ''}`}
            style={{
              width: 140,
              padding: '14px 10px',
              textAlign: 'center',
              background: p.sel ? '#fff' : 'var(--paper)',
              borderColor: p.sel ? 'var(--accent)' : 'var(--line)',
              borderWidth: p.sel ? 2 : 1.6,
              opacity: p.soon ? 0.45 : 1,
              position: 'relative',
            }}
          >
            {p.soon && (
              <span className="tag" style={{ position: 'absolute', top: -8, right: -6, background: '#fff', fontSize: 10 }}>
                即将推出
              </span>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <Platform kind={p.k} size={32} />
            </div>
            <div className="disp" style={{ fontSize: 18, lineHeight: 1.1 }}>{p.name}</div>
            <div className="mono muted" style={{ fontSize: 10, marginTop: 4 }}>{p.hint}</div>
          </div>
        ))}
      </div>
      <div className="hand muted" style={{ textAlign: 'center', fontSize: 12, marginBottom: 16 }}>
        一期先做小红书 + 小绿书 —— 这两个对"图里有字 / 多图叙事"的需求最强，能把 gpt-image-2 的能力打透
      </div>

      <div className="wf" style={{ padding: 14, marginBottom: 14 }}>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <span className="chip sel">{G.spark} 爆款标题手</span>
          <span className="chip">小红书种草体</span>
          <span className="chip">{G.plus} 挂载 Skill</span>
          <div className="grow" />
          <span className="mono muted">挂载的 Skill 会改变 Plan 的策略</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="input grow" style={{ minHeight: 60, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--ink-3)' }}>主题：周末花 200 块在胡同吃到撑 —— 7 家真不踩雷的店</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="chip">{G.attach} 参考链接 / 图</span>
            <span className="chip">{G.refresh} 灵感骰子</span>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip">9 张图 ▾</span>
            <span className="chip">4:5 ▾</span>
            <span className="chip sel">{G.layers} 经典版式 ▾</span>
            <span className="chip">中文 ▾</span>
            <span className="chip">语气：松弛 ▾</span>
          </div>
          <div className="btn primary">{G.bolt} 开始 Plan</div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="hand" style={{ fontSize: 14, fontWeight: 700 }}>今日灵感 · 按你常发的方向</div>
        <div className="hand muted" style={{ fontSize: 13 }}>{G.refresh} 换一组</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          ['💡', '顶级写作者每天第一小时做的事', '长文 · 公众号'],
          ['📷', '用 35mm 拍出"日剧感"的 7 个机位', '图文 · 小红书'],
          ['📊', '一张图看懂：港股 5 月异动盘点', '小绿书 · 单图'],
          ['☕', '咖啡机除垢 30 秒搞定', '短视频脚本'],
        ].map((x, i) => (
          <div key={i} className="wf wf-tight" style={{ padding: 10 }}>
            <div style={{ fontSize: 18 }}>{x[0]}</div>
            <div className="hand" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25, margin: '4px 0 6px' }}>{x[1]}</div>
            <div className="mono muted">{x[2]}</div>
          </div>
        ))}
      </div>

      <Sticky color="y" style={{ position: 'absolute', right: -14, top: 120, width: 200 }}>
        <b>差异化 #1</b>
        <br />
        平台优先于格式 —— 不同平台的爆款结构、视觉语言、字数限制完全不同，由它驱动后续 Plan
      </Sticky>
    </div>
  );
}
