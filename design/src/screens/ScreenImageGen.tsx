import { G, Ph, Sticky } from '../components/WfBits';

export function ScreenImageGen() {
  const W = 920;
  const H = 760;
  const cardsCfg = [
    { t: '200元胡同 · 吃到扶墙', mode: 'cover' as const },
    { t: '#01 老金涮肉', mode: 'list' as const },
    { t: '#02 馅老满', mode: 'list' as const },
    { t: '#03 牛街白记', mode: 'list' as const },
    { t: '#04 隆福寺小吃', mode: 'list' as const },
    { t: '#05 五道营烤肉', mode: 'list' as const },
    { t: '#06 鼓楼炸酱面', mode: 'list' as const },
    { t: '其实最贵的不是钱', mode: 'payoff' as const },
    { t: '点收藏 · 留言', mode: 'cta' as const },
  ];
  return (
    <div style={{ width: W, height: H, padding: '24px 28px', background: 'var(--paper)', position: 'relative' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="disp" style={{ fontSize: 24 }}>视觉</div>
          <span className="tag">gpt-image-2 · 主体一致性</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip">{G.refresh} 全部重生</span>
          <div className="btn primary">导出 9 张图 →</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 240px', gap: 14, height: H - 90 }}>
        <div className="col" style={{ gap: 12 }}>
          <div className="wf wf-tight" style={{ padding: 12 }}>
            <div className="hand" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>主体（一致性锚点）</div>
            <div className="row" style={{ gap: 6 }}>
              <Ph w={56} h={56} label="参考 1" />
              <Ph w={56} h={56} label="参考 2" />
              <div className="placeholder" style={{ width: 56, height: 56, borderStyle: 'dashed' }}>
                {G.plus}
              </div>
            </div>
            <div className="mono muted" style={{ marginTop: 8 }}>
              检测到：胡同 / 小桌 / 暖灯。9 张图将共享这套主体描述。
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <span className="ck on" />
              <span className="hand" style={{ fontSize: 13 }}>锁定光线 · 暖黄</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <span className="ck on" />
              <span className="hand" style={{ fontSize: 13 }}>锁定相机 · 35mm</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <span className="ck" />
              <span className="hand" style={{ fontSize: 13 }}>锁定人物外观</span>
            </div>
          </div>

          <div className="wf wf-tight" style={{ padding: 12 }}>
            <div className="hand" style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>艺术风格</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {['真实摄影', '日漫', '水彩', '3D 渲染', '极简线稿', '拼贴'].map((x, i) => (
                <div key={i} className="wf wf-tight" style={{ padding: 0, height: 60, position: 'relative' }}>
                  <Ph w="100%" h="100%" label={x} dark={i === 0} />
                  {i === 0 && (
                    <span className="tag" style={{ position: 'absolute', top: 4, right: 4, background: 'var(--hi)' }}>
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="wf wf-tight" style={{ padding: 12 }}>
            <div className="hand" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>文字渲染（小绿书）</div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <span className="ck on" />
              <span className="hand" style={{ fontSize: 13 }}>把标题烧进图里</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <span className="rd on" />
              <span className="hand" style={{ fontSize: 13 }}>大字 · 顶部居中</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 2 }}>
              <span className="rd" />
              <span className="hand" style={{ fontSize: 13 }}>书法竖排 · 右</span>
            </div>
            <div className="mono muted" style={{ marginTop: 6 }}>由 gpt-image-2 直出文字，无需后期合成</div>
          </div>
        </div>

        <div className="wf" style={{ padding: 14, overflow: 'hidden' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <b className="hand" style={{ fontSize: 14 }}>9 张图 · 主体一致 · 文字已嵌入</b>
            <span className="mono muted">悬停单卡可"局部重生 / 改文案 / 替换主体"</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {cardsCfg.map((c, i) => (
              <div
                key={i}
                className="wf wf-tight"
                style={{
                  padding: 0,
                  aspectRatio: '4/5',
                  position: 'relative',
                  overflow: 'hidden',
                  background: c.mode === 'cover' ? '#3a2e1a' : c.mode === 'payoff' ? '#1a2a3a' : '#1a1a1a',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      c.mode === 'cover'
                        ? 'radial-gradient(circle at 30% 40%, #c97a3a, #2a1a0a)'
                        : c.mode === 'payoff'
                        ? 'radial-gradient(circle at 70% 60%, #4477aa, #0a1a2a)'
                        : c.mode === 'cta'
                        ? 'radial-gradient(circle at 50% 50%, #2dbe60, #0a2a1a)'
                        : `repeating-linear-gradient(${30 + i * 15}deg, #2a2418 0 8px, #1a1410 8px 16px)`,
                    opacity: 0.92,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: c.mode === 'cover' ? 'flex-end' : 'center',
                    alignItems: c.mode === 'list' ? 'flex-start' : 'center',
                    color: '#fff',
                  }}
                >
                  <div
                    className="disp"
                    style={{
                      fontSize: c.mode === 'cover' ? 20 : 14,
                      lineHeight: 1.1,
                      textAlign: 'center',
                      textShadow: '1px 1px 0 rgba(0,0,0,.6)',
                    }}
                  >
                    {c.t}
                  </div>
                </div>
                <span
                  className="tag"
                  style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(255,255,255,.9)' }}
                >
                  {i + 1}
                </span>
                {i === 4 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      border: '2.4px solid var(--accent)',
                      boxShadow: 'inset 0 0 0 2px #fff',
                    }}
                  >
                    <span
                      className="tag"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'var(--accent)',
                        color: '#fff',
                      }}
                    >
                      {G.refresh} 重生中
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="wf" style={{ padding: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <b className="hand" style={{ fontSize: 14 }}>第 5 张 · 局部重生</b>
            <span className="tag">{G.edit}</span>
          </div>
          <Ph w="100%" h={140} label="card #5 preview" />
          <div className="hand" style={{ fontSize: 12, marginTop: 8, fontWeight: 700 }}>提示词（继承全局）</div>
          <div className="input" style={{ fontSize: 12, padding: '6px 8px', marginTop: 4, lineHeight: 1.4 }}>
            <span style={{ opacity: 0.5 }}>+ 全局：胡同, 35mm, 暖黄</span>
            <br />
            隆福寺街头小吃摊，<span style={{ background: 'var(--hi)' }}>傍晚 6 点</span>，蒸汽，烤串
          </div>
          <div className="hand" style={{ fontSize: 12, marginTop: 8, fontWeight: 700 }}>烧进图的文字</div>
          <div className="input" style={{ fontSize: 12, padding: '6px 8px', marginTop: 4 }}>#04 隆福寺小吃</div>
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span className="chip">{G.refresh} 重生</span>
            <span className="chip">蒙版重绘</span>
            <span className="chip">替换主体</span>
          </div>
          <div className="hr" />
          <div className="hand" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>历史版本</div>
          <div className="row" style={{ gap: 4 }}>
            <Ph w={48} h={60} label="v1" />
            <Ph w={48} h={60} label="v2" dark />
            <Ph w={48} h={60} label="v3*" />
          </div>
        </div>
      </div>

      <Sticky color="g" style={{ position: 'absolute', left: -12, bottom: 14, width: 220 }}>
        <b>差异化 #4</b>
        <br />
        小绿书最难的是"图里要有正经汉字"。gpt-image-2 直接出文字 + 主体一致性锁，让 9 张图像同一个故事，而不是 9 张拼凑。
      </Sticky>
    </div>
  );
}
