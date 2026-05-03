import type { CSSProperties, ReactNode } from 'react';

const tokens = {
  ink: '#0F0F12',
  ink2: '#3A3A42',
  ink3: '#7A7A85',
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  line: '#E6E4DC',
  redbook: '#FF4D6D',
  greenbook: '#1FB967',
  ai: '#5B6CFF',
  hi: '#FFE680',
  warn: '#FF8A3D',
  ok: '#1FB967',
};

type Tokens = typeof tokens;

function SGSection({ num, title, hint, children }: { num: string; title: string; hint: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#7A7A85' }}>{num}</span>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 13, color: '#7A7A85' }}>· {hint}</span>
      </div>
      {children}
    </div>
  );
}

function SwatchSm({ color, name, hex, note, dark }: { color: string; name: string; hex: string; note: string; dark?: boolean }) {
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          height: 60,
          background: color,
          border: '1px solid #E6E4DC',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'flex-end',
          padding: 6,
          color: dark ? '#fff' : '#0F0F12',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 10,
        }}
      >
        {hex}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 5 }}>{name}</div>
      <div style={{ fontSize: 10, color: '#7A7A85' }}>{note}</div>
    </div>
  );
}

function Comp({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div style={{ padding: 16, background: '#F5F4EE', border: `1px dashed ${tokens.line}`, borderRadius: 14 }}>
      <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 2 }}>{sub}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      <div style={{ padding: 14, background: tokens.bg, borderRadius: 10 }}>{children}</div>
    </div>
  );
}

type ButtonKind = 'primary' | 'ghost' | 'default';
function btn(t: Tokens, kind: ButtonKind = 'default'): CSSProperties {
  if (kind === 'primary')
    return {
      padding: '7px 14px',
      background: t.ink,
      color: '#fff',
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'PingFang SC, sans-serif',
    };
  if (kind === 'ghost')
    return {
      padding: '7px 14px',
      background: 'transparent',
      color: t.ink2,
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 500,
      border: `1px solid ${t.line}`,
    };
  return {
    padding: '7px 14px',
    background: t.surface,
    color: t.ink,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    border: `1px solid ${t.line}`,
  };
}

function skillChip(t: Tokens, n: number | null, on: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: n != null ? '5px 10px 5px 5px' : '5px 10px 5px 10px',
    background: on ? t.surface : 'transparent',
    border: on ? `1px solid ${t.line}` : `1px dashed ${t.line}`,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: on ? t.ink : t.ink3,
    boxShadow: on ? '0 1px 3px rgba(15,15,18,.04)' : 'none',
    position: 'relative',
  };
}

function roleTag(): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 4,
    border: '1px solid',
    background: 'transparent',
    letterSpacing: 0.5,
  };
}

function miniChip(t: Tokens): CSSProperties {
  return {
    padding: '3px 8px',
    background: t.surface,
    border: `1px solid ${t.line}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    color: t.ink2,
  };
}

export function ScreenStyleGuide() {
  const W = 920;
  const H = 1180;
  return (
    <div
      style={{
        width: W,
        height: H,
        padding: '30px 36px',
        background: tokens.bg,
        color: tokens.ink,
        fontFamily: '-apple-system, "PingFang SC", sans-serif',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
        <div style={{ fontFamily: 'var(--font-disp)', fontSize: 42, lineHeight: 1, fontWeight: 700 }}>
          Visual System
        </div>
        <div className="hand muted" style={{ fontSize: 14 }}>正式产品的设计语言（不是 wireframe 草图）</div>
      </div>
      <div style={{ height: 1, background: tokens.line, margin: '14px 0 22px' }} />

      {/* 01 设计哲学 */}
      <SGSection num="01" title="设计哲学" hint="三个关键词决定一切">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {([
            ['编辑部 (Editorial)', '信息密度高、版式有节奏。像翻一本好杂志，而不是逛工具栏。', tokens.ink],
            ['暖中性 (Warm Neutral)', '底色是带温度的米白，不是冷蓝白。让创作不焦虑。', tokens.redbook],
            ['指令优先 (Verb-first)', 'UI 让位给"命令"。⌘K 比侧栏更重要。', tokens.ai],
          ] as [string, string, string][]).map((c, i) => (
            <div
              key={i}
              style={{
                padding: 18,
                background: tokens.surface,
                border: `1px solid ${tokens.line}`,
                borderRadius: 14,
                position: 'relative',
              }}
            >
              <div style={{ width: 32, height: 4, background: c[2], borderRadius: 2, marginBottom: 14 }} />
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{c[0]}</div>
              <div style={{ fontSize: 13, color: tokens.ink2, lineHeight: 1.55 }}>{c[1]}</div>
            </div>
          ))}
        </div>
      </SGSection>

      {/* 02 色彩 */}
      <SGSection num="02" title="色彩" hint="一个中性底 + 双平台主色 + AI 紫蓝">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>
              NEUTRAL · 暖中性
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                ['Ink', tokens.ink, '#0F0F12', '正文 / 标题'],
                ['Ink-2', tokens.ink2, '#3A3A42', '次要文字'],
                ['Ink-3', tokens.ink3, '#7A7A85', '辅助 / 占位'],
                ['Line', tokens.line, '#E6E4DC', '分割线'],
                ['Surf', tokens.surface, '#FFFFFF', '卡片底'],
                ['BG', tokens.bg, '#FAFAF7', '页底'],
              ] as [string, string, string, string][]).map((c, i) => (
                <SwatchSm key={i} color={c[1]} name={c[0]} hex={c[2]} note={c[3]} dark={i < 2} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>
              ACCENT · 平台主色 + AI
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                ['Redbook', tokens.redbook, '#FF4D6D', '小红书场景'],
                ['Greenbook', tokens.greenbook, '#1FB967', '小绿书场景'],
                ['AI', tokens.ai, '#5B6CFF', 'Agent / Skills'],
                ['Hi', tokens.hi, '#FFE680', '高亮 / 已选'],
                ['Warn', tokens.warn, '#FF8A3D', '警告'],
              ] as [string, string, string, string][]).map((c, i) => (
                <SwatchSm key={i} color={c[1]} name={c[0]} hex={c[2]} note={c[3]} dark />
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: tokens.surface,
            border: `1px solid ${tokens.line}`,
            borderRadius: 10,
            fontSize: 13,
            color: tokens.ink2,
            lineHeight: 1.6,
          }}
        >
          <b style={{ color: tokens.ink }}>用法约束</b> · 同一屏最多出现两种品牌色。Redbook & Greenbook
          互斥（按当前项目所属平台）。AI 紫只在 Agent 触发的元素上出现，不做装饰用。禁止整屏渐变背景。
        </div>
      </SGSection>

      {/* 03 字体 */}
      <SGSection num="03" title="字体" hint="中文 PingFang，英文 Inter，数字等宽 IBM Plex Mono">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ padding: 18, background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>DISPLAY · 标题</div>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }}>200块吃到扶墙出</div>
            <div style={{ fontSize: 11, color: tokens.ink3, marginTop: 10 }}>
              PingFang SC Semibold · 28-44 / line 1.1 / -2% letter-spacing
            </div>
          </div>
          <div style={{ padding: 18, background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>BODY · 正文</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: tokens.ink2 }}>
              胡同里的真不踩雷小馆，从老金涮肉到馅老满，7 家店把 200
              块吃出仪式感。AI 会把每一家拆成"招牌 / 价位 / 避雷"三段式。
            </div>
            <div style={{ fontSize: 11, color: tokens.ink3, marginTop: 10 }}>PingFang SC Regular · 13-15 / line 1.6-1.7</div>
          </div>
          <div style={{ padding: 18, background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>MONO · 数据 / 元信息</div>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 13, lineHeight: 1.6 }}>
              9 cards · 4:5 · 1242×1553
              <br />
              gen_4f9c · 2026-05-03 16:08
            </div>
            <div style={{ fontSize: 11, color: tokens.ink3, marginTop: 10 }}>IBM Plex Mono · 11-13 / 用于尺寸、ID、时间戳</div>
          </div>
          <div style={{ padding: 18, background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>UI · 控件</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={btn(tokens, 'primary')}>开始 Plan</span>
              <span style={btn(tokens)}>挂载 Skill</span>
              <span style={btn(tokens, 'ghost')}>取消</span>
            </div>
            <div style={{ fontSize: 11, color: tokens.ink3, marginTop: 10 }}>PingFang SC Medium · 13-14 / 不用 Bold（留给标题）</div>
          </div>
        </div>
      </SGSection>

      {/* 04 组件 */}
      <SGSection num="04" title="核心组件" hint="只列出该产品独有/特殊处理的">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Comp title="Skill Chip" sub="挂载状态 / 优先级">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={skillChip(tokens, 1, true)}>1 · 爆款标题手</span>
              <span style={skillChip(tokens, 2, true)}>2 · 小红书种草体</span>
              <span style={skillChip(tokens, null, false)}>+ 加 Skill</span>
            </div>
            <div style={{ fontSize: 12, color: tokens.ink3, marginTop: 8, lineHeight: 1.5 }}>
              数字徽章用 AI 紫；未挂载时虚线 + 浅灰；可拖拽改优先级。
            </div>
          </Comp>

          <Comp title="Role Tag" sub="叙事角色（封面/钩子/CTA）">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                ['封面', tokens.redbook],
                ['钩子', tokens.warn],
                ['清单', tokens.ink],
                ['Payoff', tokens.ai],
                ['CTA', tokens.greenbook],
              ] as [string, string][]).map((r, i) => (
                <span key={i} style={{ ...roleTag(), color: r[1], borderColor: r[1] }}>
                  {r[0]}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: tokens.ink3, marginTop: 8, lineHeight: 1.5 }}>
              色随角色，不随主题。让爆款结构变成可视化语言。
            </div>
          </Comp>

          <Comp title="⌘K Command Bar" sub="自由说 + 候选指令">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: tokens.surface,
                border: `1px solid ${tokens.line}`,
                borderRadius: 14,
                boxShadow: '0 6px 20px rgba(15,15,18,.08)',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: tokens.ai,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                K
              </div>
              <span style={{ fontSize: 13, color: tokens.ink3 }}>让 Agent 把它改成…</span>
              <span style={miniChip(tokens)}>更短</span>
              <span style={miniChip(tokens)}>加价格锚点</span>
              <span style={{ ...miniChip(tokens), background: tokens.ink, color: '#fff', borderColor: tokens.ink }}>
                ⌘ + ↵
              </span>
            </div>
            <div style={{ fontSize: 12, color: tokens.ink3, marginTop: 8, lineHeight: 1.5 }}>
              悬浮在编辑器底部；支持自然语言或一键候选。
            </div>
          </Comp>

          <Comp title="Agent Suggestion" sub="主动建议卡 · 可采纳/忽略">
            <div
              style={{
                padding: '10px 12px',
                background: '#FFF8E5',
                border: `1px solid #F0D77A`,
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <b style={{ color: tokens.ink }}>建议</b> · 第 5 张密度过高，拆成 5a/5b？
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <span style={{ ...miniChip(tokens), background: tokens.ink, color: '#fff', borderColor: tokens.ink }}>采纳</span>
                <span style={miniChip(tokens)}>忽略</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: tokens.ink3, marginTop: 8, lineHeight: 1.5 }}>
              三种色：黄=结构 / 蓝=平台 SOP / 紫=技术（如分辨率）。
            </div>
          </Comp>

          <Comp title="Image Card" sub="gpt-image-2 直出 · 文字烧入">
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 90,
                    aspectRatio: '4/5',
                    borderRadius: 8,
                    position: 'relative',
                    overflow: 'hidden',
                    background:
                      i === 0
                        ? 'radial-gradient(120% 80% at 30% 40%, #C97A3A, #2A1A0A)'
                        : i === 1
                        ? 'radial-gradient(120% 80% at 70% 60%, #1FB967, #0A2A1A)'
                        : 'radial-gradient(120% 80% at 50% 30%, #5B6CFF, #1A1A2A)',
                    border: `1px solid ${tokens.line}`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      padding: 8,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'flex-end',
                      fontFamily: 'PingFang SC, sans-serif',
                      fontWeight: 700,
                      fontSize: 13,
                      lineHeight: 1.1,
                      textShadow: '0 1px 2px rgba(0,0,0,.5)',
                    }}
                  >
                    {['200块吃到扶墙', '#01 老金涮肉', '其实最贵的'][i]}
                  </div>
                  <span
                    style={{
                      position: 'absolute',
                      top: 5,
                      left: 5,
                      background: 'rgba(255,255,255,.92)',
                      color: tokens.ink,
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 9,
                      padding: '1px 5px',
                      borderRadius: 3,
                    }}
                  >
                    {i + 1}/9
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: tokens.ink3, marginTop: 8, lineHeight: 1.5 }}>
              所有卡共享主体锚点 · 单卡支持局部重生 / 蒙版 / 历史。
            </div>
          </Comp>

          <Comp title="Plan Node" sub="可拖拽 · 可对话改写">
            <div
              style={{
                padding: 10,
                background: tokens.surface,
                border: `1px solid ${tokens.line}`,
                borderRadius: 10,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <span style={{ color: tokens.ink3, fontSize: 14 }}>⋮⋮</span>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: tokens.ai,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                3
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                  <span style={{ ...roleTag(), color: tokens.ink, borderColor: tokens.ink, fontSize: 10 }}>清单</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: tokens.ink3 }}>
                    edited 2m ago
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>#01 老金涮肉 · 38￥</div>
              </div>
              <span style={{ fontSize: 13, color: tokens.ink3 }}>✦</span>
            </div>
          </Comp>
        </div>
      </SGSection>

      {/* 05 间距与圆角 */}
      <SGSection num="05" title="间距 / 圆角 / 投影" hint="4-pt 基准；圆角分两档；投影只用于浮层">
        <div style={{ display: 'flex', gap: 30, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>SPACING</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              {[4, 8, 12, 16, 24, 32].map((s) => (
                <div key={s} style={{ textAlign: 'center' }}>
                  <div style={{ width: s, height: s, background: tokens.ink }} />
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: tokens.ink3, marginTop: 6 }}>
                    {s}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>RADIUS</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              {([
                ['8 / 控件', 8],
                ['14 / 卡片', 14],
                ['999 / 药丸', 999],
              ] as [string, number][]).map(([n, r], i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      background: tokens.surface,
                      border: `1px solid ${tokens.line}`,
                      borderRadius: r,
                    }}
                  />
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: tokens.ink3, marginTop: 6 }}>
                    {n}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: tokens.ink3, letterSpacing: 1, marginBottom: 8 }}>SHADOW</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                ['none', 'none', '默认'],
                ['hover', '0 2px 8px rgba(15,15,18,.06)', '卡片悬停'],
                ['float', '0 8px 24px rgba(15,15,18,.10)', '⌘K / 弹层'],
              ] as [string, string, string][]).map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      background: tokens.surface,
                      border: `1px solid ${tokens.line}`,
                      borderRadius: 10,
                      boxShadow: s[1],
                    }}
                  />
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: tokens.ink3, marginTop: 6 }}>
                    {s[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SGSection>

      {/* 06 Voice & Tone */}
      <SGSection num="06" title="Voice · Agent 怎么说话" hint="所有 AI 文案都过这套">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {([
            ['做', '像同事不像客服。"我把 #5 拆了，要保留吗？"', tokens.greenbook],
            ['做', '显式说明意图。"这是为了和 #2 呼应"', tokens.greenbook],
            ['做', '给可逆操作。"采纳 / 撤回 / 看我做了什么"', tokens.greenbook],
            ['不做', '拟人过度。不用"亲爱的""主人"', tokens.redbook],
            ['不做', '废话开头。不用"好的，我来帮您…"', tokens.redbook],
            ['不做', '不可逆默认。从不静默改，永远先问后改', tokens.redbook],
          ] as [string, string, string][]).map((x, i) => (
            <div
              key={i}
              style={{
                padding: '10px 14px',
                background: tokens.surface,
                border: `1px solid ${tokens.line}`,
                borderRadius: 10,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: x[2],
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {x[0]}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: tokens.ink2 }}>{x[1]}</span>
            </div>
          ))}
        </div>
      </SGSection>

      {/* 07 Motion */}
      <SGSection num="07" title="Motion · 动效原则" hint="只为了表达因果，不装饰">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {([
            ['Plan 节点变化', '卡片高亮 200ms +1px 上浮，让"哪儿改了"一眼看到'],
            ['图像生成中', '边框流动渐变（AI紫→透明），不旋转转圈'],
            ['Skill 挂载', '从底部滑入 + 数字徽章弹跳（spring 0.4）'],
          ] as [string, string][]).map((x, i) => (
            <div
              key={i}
              style={{
                padding: 14,
                background: tokens.surface,
                border: `1px solid ${tokens.line}`,
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{x[0]}</div>
              <div style={{ fontSize: 12, color: tokens.ink2, lineHeight: 1.55 }}>{x[1]}</div>
            </div>
          ))}
        </div>
      </SGSection>
    </div>
  );
}
