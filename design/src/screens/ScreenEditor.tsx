import { G, Ph, Sticky } from '../components/WfBits';

export function ScreenEditor() {
  const W = 920;
  const H = 760;
  return (
    <div
      style={{
        width: W,
        height: H,
        padding: '18px 22px',
        background: 'var(--paper)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="hand" style={{ fontWeight: 700 }}>200 块吃到扶墙出 · 9 卡</span>
          <span className="tag">小红书 · 4:5</span>
          <span className="tag" style={{ background: 'var(--hi)' }}>已保存 · 2 分钟前</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="chip">预览</span>
          <span className="chip">{G.download} 导出 ZIP</span>
          <span className="chip">直发小红书</span>
          <div className="btn primary">{G.spark} Agent</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 240px', gap: 12, flex: 1, minHeight: 0 }}>
        <div className="wf" style={{ padding: 8, overflow: 'hidden' }}>
          <div className="hand" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>卡片</div>
          <div className="col" style={{ gap: 6 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="row"
                style={{
                  gap: 6,
                  padding: '4px 6px',
                  background: i === 2 ? 'var(--hi)' : '#fff',
                  border: '1.2px solid var(--line)',
                  borderRadius: 6,
                }}
              >
                <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                <Ph w={22} h={28} />
                <span className="hand" style={{ fontSize: 11, lineHeight: 1.1 }}>
                  {['封面', '立论', '01 老金', '02 馅老满', '03 牛街', '04 隆福', '05 五道', 'Payoff', 'CTA'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="wf stripe"
          style={{
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="mono muted" style={{ position: 'absolute', top: 8, left: 10 }}>第 3 张 · 100%</div>
          <div className="phone" style={{ marginTop: 12 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 30% 40%, #c97a3a, #2a1a0a)',
              }}
            />
            <div style={{ position: 'absolute', top: 14, left: 14, right: 14 }}>
              <div
                className="disp"
                style={{ fontSize: 30, color: '#fff', lineHeight: 1, textShadow: '1px 1px 0 rgba(0,0,0,.6)' }}
              >
                #01
                <br />
                老金涮肉
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, color: '#fff' }}>
              <div className="hand" style={{ fontSize: 13, opacity: 0.95 }}>38元 · 自助小料 · 铜锅</div>
              <div className="mono" style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>📍 鼓楼东大街 · 排队 20min</div>
            </div>
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                right: 10,
                height: 80,
                border: '1.6px dashed var(--accent)',
              }}
            />
            <div
              className="tag"
              style={{
                position: 'absolute',
                top: -2,
                left: 10,
                background: 'var(--accent)',
                color: '#fff',
                borderColor: 'var(--line)',
              }}
            >
              已选 · 标题
            </div>
          </div>

          <div
            className="wf"
            style={{
              position: 'absolute',
              bottom: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '8px 10px',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              minWidth: 420,
              background: '#fff',
            }}
          >
            {G.spark}
            <span className="hand" style={{ fontSize: 13, fontWeight: 700 }}>让 Agent 把它改成…</span>
            <span className="chip">更短</span>
            <span className="chip">加 emoji</span>
            <span className="chip">加价格锚点</span>
            <span className="chip dark">⌘K 自由说</span>
          </div>
        </div>

        <div className="col" style={{ gap: 10, minHeight: 0, overflow: 'hidden' }}>
          <div className="wf" style={{ padding: 10 }}>
            <div className="hand" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>属性 · 标题文本</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <span className="chip">字体 ▾</span>
              <span className="chip">36 ▾</span>
              <span className="chip dark">B</span>
            </div>
            <div className="hr" />
            <div className="hand" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>底图（gpt-image-2）</div>
            <div className="row" style={{ gap: 6 }}>
              <Ph w={56} h={70} label="v1" />
              <Ph w={56} h={70} label="v2" dark />
            </div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <span className="chip">{G.refresh} 重生</span>
              <span className="chip">蒙版改</span>
            </div>
          </div>

          <div className="wf" style={{ padding: 10, flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <b className="hand" style={{ fontSize: 13 }}>Agent 建议 · 3</b>
              <span className="tag">基于 Skill</span>
            </div>
            <Sticky color="b" style={{ transform: 'none', marginBottom: 6, padding: '6px 8px', fontSize: 12 }}>
              第 3 张和第 5 张标题结构太相似，要不要让 #5 用问句开头？
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                <span className="chip dark">采纳</span>
                <span className="chip">忽略</span>
              </div>
            </Sticky>
            <Sticky color="y" style={{ transform: 'none', marginBottom: 6, padding: '6px 8px', fontSize: 12 }}>
              小红书 SOP 检查：你还没加"避雷"段，要不要在 CTA 前插入一张反向卡？
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                <span className="chip dark">让我看</span>
                <span className="chip">不用</span>
              </div>
            </Sticky>
            <Sticky color="p" style={{ transform: 'none', padding: '6px 8px', fontSize: 12 }}>
              检测到 #4 的图在小屏会糊 —— 自动重生 1024px 版本？
              <div className="row" style={{ gap: 4, marginTop: 4 }}>
                <span className="chip dark">好</span>
                <span className="chip">忽略</span>
              </div>
            </Sticky>
          </div>
        </div>
      </div>

      <Sticky color="p" style={{ position: 'absolute', right: -14, top: 160, width: 200 }}>
        <b>差异化 #5</b>
        <br />
        Agent 主动 review，按平台 SOP 找问题；不靠死规则，靠挂载的 Skills 决定"什么算好"
      </Sticky>
    </div>
  );
}
