import { G, Ph, Sticky } from '../components/WfBits';

export function ScreenSkills() {
  const W = 920;
  const H = 700;
  const skills = [
    { name: '爆款标题手', by: '@咪蒙的 AI', pulls: '12.8k', tags: ['标题', '钩子'], eq: true, acc: 'var(--accent)' },
    { name: '小红书种草体', by: '@小红书官方', pulls: '48.2k', tags: ['文案', '语气'], eq: true, acc: 'var(--accent)' },
    { name: '小绿书摄影', by: '@图像学院', pulls: '9.1k', tags: ['图像', '一致性'], eq: false, acc: 'var(--accent-2)' },
    { name: '数据可视化', by: '@DataLab', pulls: '4.7k', tags: ['图表', '排版'], eq: false, acc: 'var(--accent-3)' },
    { name: '职场吐槽体', by: '@脉脉精选', pulls: '6.3k', tags: ['情绪', '文案'], eq: false, acc: '#7c3aed' },
    { name: '低糖冷淡风', by: '@Muji 风', pulls: '15.0k', tags: ['视觉', '字体'], eq: false, acc: '#888' },
  ];
  return (
    <div style={{ width: W, height: H, padding: '24px 28px', background: 'var(--paper)', position: 'relative' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="disp" style={{ fontSize: 30 }}>Skills</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip">{G.plus} 自建 Skill</span>
          <div className="btn primary">应用到当前项目</div>
        </div>
      </div>
      <div className="hand muted" style={{ fontSize: 14, marginBottom: 14 }}>
        Skill = 一组 prompt + 风格参考图 + 输出约束。挂载多个 Skills 会"叠加"——按优先级排序
      </div>

      <div className="wf" style={{ padding: 12, marginBottom: 14, background: '#fff' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <b className="hand" style={{ fontSize: 14 }}>当前挂载（拖拽改优先级）</b>
          <span className="mono muted">2 / 5 槽位</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="chip sel" style={{ padding: '8px 12px' }}>
            <span style={{ opacity: 0.5 }}>{G.drag}</span>
            <span style={{ fontWeight: 700 }}>1 · 爆款标题手</span>
            <span className="mono muted">影响：标题/钩子</span>
            <span>×</span>
          </div>
          <div className="chip sel" style={{ padding: '8px 12px' }}>
            <span style={{ opacity: 0.5 }}>{G.drag}</span>
            <span style={{ fontWeight: 700 }}>2 · 小红书种草体</span>
            <span className="mono muted">影响：正文语气</span>
            <span>×</span>
          </div>
          <div className="chip" style={{ borderStyle: 'dashed', boxShadow: 'none', background: 'transparent' }}>
            {G.plus} 加 Skill
          </div>
          <div className="grow" />
          <span className="chip">{G.spark} 预览叠加效果</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 18 }}>
        <div className="col" style={{ gap: 6 }}>
          <div className="hand" style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>分类</div>
          {['全部', '文案 / 语气', '视觉 / 风格', '图像生成', '数据 / 图表', '叙事结构', '平台原生'].map((x, i) => (
            <div
              key={i}
              className="hand"
              style={{
                fontSize: 14,
                padding: '4px 8px',
                background: i === 0 ? 'var(--hi)' : 'transparent',
                border: i === 0 ? '1.4px solid var(--line)' : '1.4px solid transparent',
                borderRadius: 6,
              }}
            >
              {x}
            </div>
          ))}
          <div className="hr" />
          <div className="hand" style={{ fontSize: 13, fontWeight: 700 }}>排序</div>
          <div className="hand muted" style={{ fontSize: 13 }}>· 本周热门</div>
          <div className="hand muted" style={{ fontSize: 13 }}>· 我关注的人</div>
          <div className="hand muted" style={{ fontSize: 13 }}>· 与当前项目最匹配</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {skills.map((s, i) => (
            <div key={i} className="wf wf-tight" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: s.acc,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontFamily: 'var(--font-disp)',
                    fontWeight: 700,
                    border: '1.4px solid var(--line)',
                  }}
                >
                  {s.name[0]}
                </div>
                {s.eq ? (
                  <span className="tag" style={{ background: 'var(--hi)' }}>已挂载</span>
                ) : (
                  <span className="tag">{G.plus} 挂载</span>
                )}
              </div>
              <div className="hand" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{s.name}</div>
              <div className="mono muted" style={{ margin: '4px 0 6px' }}>{s.by} · ↓ {s.pulls}</div>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {s.tags.map((t, j) => (
                  <span key={j} className="tag">{t}</span>
                ))}
              </div>
              <div className="row" style={{ gap: 4, marginTop: 8 }}>
                <Ph w={42} h={32} />
                <Ph w={42} h={32} />
                <Ph w={42} h={32} />
                <Ph w={42} h={32} dark />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sticky color="p" style={{ position: 'absolute', right: -16, top: 200, width: 200 }}>
        <b>差异化 #3</b>
        <br />
        Skills 不只是模板——它带着 prompt、参考图、输出格式约束，AI 会真的"按这个能力包思考"。可叠加、可分享。
      </Sticky>
    </div>
  );
}
