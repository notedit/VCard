import { Arrow } from '../components/WfBits';

export function ScreenPositioning() {
  const W = 920;
  const H = 700;
  return (
    <div style={{ width: W, height: H, padding: '30px 40px', background: 'var(--paper)', position: 'relative' }}>
      <div className="disp" style={{ fontSize: 46, lineHeight: 1, marginBottom: 6 }}>
        卡片 <span style={{ color: 'var(--accent)' }}>·</span> 社媒 Studio
      </div>
      <div className="hand muted" style={{ fontSize: 16, marginBottom: 6 }}>
        把"主题 → 爆款图文"做成一条工作流，每一步都可由 Agent 推进
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 18 }}>
        <span className="pill acc">一期 · 小红书</span>
        <span className="pill acc2">一期 · 小绿书</span>
        <span className="pill" style={{ opacity: 0.5 }}>二期 · 公众号 / 抖音 / 微博</span>
        <a href="prd.html" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', marginLeft: 'auto' }}>
          <span className="pill solid" style={{ cursor: 'pointer' }}>📄 完整 PRD →</span>
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }}>
        <div>
          <div className="hand" style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>一句话定位</div>
          <div className="wf" style={{ padding: 14, marginBottom: 14 }}>
            <div className="disp" style={{ fontSize: 24, lineHeight: 1.2 }}>
              一个<span style={{ background: 'var(--hi)' }}> AI native </span>的{' '}
              <span style={{ color: 'var(--accent)' }}>社媒卡片</span> 工作台 ——
              <br />
              你给主题，它出爆款。
            </div>
          </div>

          <div className="hand" style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>vs Gamma 社媒</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-hand)', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1.4px solid var(--line)' }}>
                <th style={{ padding: 6 }}></th>
                <th style={{ padding: 6, color: 'var(--ink-3)' }}>Gamma</th>
                <th style={{ padding: 6, color: 'var(--accent)' }}>我们</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['入口', '通用格式选择', '按目标平台分流'],
                ['Plan', '静态大纲', '可对话 · agent 推进'],
                ['图像', '风格预设 + 通用模型', 'gpt-image-2 · 主体一致 · 烧字'],
                ['复用', '主题 / 模板', 'Skills（prompt+参考+约束）'],
                ['编辑', '所见即所得', '自然语言指令 + Agent 评审'],
                ['输出', '导出图片', '一键直发 / 分平台尺寸打包'],
              ].map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px dashed var(--rule)' }}>
                  <td style={{ padding: 6, fontWeight: 700 }}>{r[0]}</td>
                  <td style={{ padding: 6, color: 'var(--ink-3)' }}>{r[1]}</td>
                  <td style={{ padding: 6 }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="hand" style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>用户旅程</div>
          <svg viewBox="-70 0 450 380" width="100%" height="380" style={{ overflow: 'visible' }}>
            {([
              [50, 40, '1. 选平台'],
              [220, 40, '2. 输主题 + 挂 Skills'],
              [50, 140, '3. AI Plan · 可对话改'],
              [220, 140, '4. 选模板 / 风格'],
              [50, 240, '5. 图像生成 · 一致性'],
              [220, 240, '6. 编辑器 · Agent 审'],
              [135, 340, '7. 一键直发'],
            ] as [number, number, string][]).map(([x, y, t], i) => (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width="130"
                  height="46"
                  rx="8"
                  fill={i === 6 ? '#1a1a1a' : '#fff'}
                  stroke="#1a1a1a"
                  strokeWidth="1.6"
                />
                <text
                  x={x + 65}
                  y={y + 28}
                  textAnchor="middle"
                  fontFamily='Kalam, "PingFang SC", "Hiragino Sans GB", sans-serif'
                  fontWeight="700"
                  fontSize="14"
                  fill={i === 6 ? '#fff' : '#1a1a1a'}
                >
                  {t}
                </text>
              </g>
            ))}
            <Arrow from={[180, 63]} to={[220, 63]} />
            <Arrow from={[285, 86]} to={[180, 140]} curve={-0.2} />
            <Arrow from={[180, 163]} to={[220, 163]} />
            <Arrow from={[285, 186]} to={[180, 240]} curve={-0.2} />
            <Arrow from={[180, 263]} to={[220, 263]} />
            <Arrow from={[285, 286]} to={[200, 340]} curve={0.2} />
            <g>
              <path
                d="M 50 60 Q -30 180 50 280"
                fill="none"
                stroke="#ff5a3c"
                strokeWidth="1.6"
                strokeDasharray="4 4"
              />
              <text
                x="-20"
                y="178"
                fontFamily='Kalam, "PingFang SC", "Hiragino Sans GB", sans-serif'
                fontSize="12"
                fill="#ff5a3c"
              >
                Skills
              </text>
              <text
                x="-20"
                y="194"
                fontFamily='Kalam, "PingFang SC", "Hiragino Sans GB", sans-serif'
                fontSize="12"
                fill="#ff5a3c"
              >
                全程参与
              </text>
            </g>
          </svg>
        </div>
      </div>

      <div className="hr" style={{ margin: '14px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          ['平台原生', '一个平台一套规则。视觉、字数、爆款结构由"目标平台"驱动。'],
          ['Agent 优先', '大事 Plan，小事 ⌘K。Agent 是动词，不是助手图标。'],
          ['Skills 可叠', '能力像乐高。"标题手 + 摄影师 + 数据控"自由组合。'],
          ['图像 first-class', 'gpt-image-2 直出文字 / 主体一致，不是后期合成。'],
        ].map((x, i) => (
          <div key={i} className="wf wf-tight" style={{ padding: 10 }}>
            <div className="disp" style={{ fontSize: 18 }}>{x[0]}</div>
            <div className="hand muted" style={{ fontSize: 13, lineHeight: 1.4, marginTop: 4 }}>{x[1]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
