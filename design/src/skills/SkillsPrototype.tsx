import { useEffect, useMemo, useState } from 'react';

type CategoryId = 'news' | 'knowledge' | 'opinion' | 'cover';
type View = 'feed' | 'running' | 'result' | 'cover';
type CardTone = 'plain' | 'pro' | 'impact';
type CoverAlign = 'center' | 'left';
type CoverTheme = 'light' | 'dark' | 'tech';

type Skill = {
  id: string;
  category: CategoryId;
  title: string;
  description: string;
  output: string;
  badge: string;
};

type ContentCard = {
  id: string;
  label: string;
  title: string;
  body: string;
};

const categories: Array<{ id: CategoryId; label: string; title: string }> = [
  { id: 'news', label: '资讯解读', title: '资讯解读（推荐）' },
  { id: 'knowledge', label: '知识总结', title: '知识总结' },
  { id: 'opinion', label: '观点表达', title: '观点表达' },
  { id: 'cover', label: '公众号封面', title: '公众号封面' },
];

const skills: Skill[] = [
  {
    id: 'ai-product-brief',
    category: 'news',
    title: 'AI 新品解读卡片',
    description: '把产品发布拆成封面、变化、影响和结论。',
    output: '5 张卡结构',
    badge: '推荐',
  },
  {
    id: 'hot-event-breakdown',
    category: 'news',
    title: '热点事件拆解',
    description: '先讲发生了什么，再讲各方位置和趋势。',
    output: '结构化输出',
    badge: '热点',
  },
  {
    id: 'industry-trend',
    category: 'news',
    title: '行业趋势总结',
    description: '从信息堆里提炼趋势、判断和可引用结论。',
    output: '分析 + 结论',
    badge: '趋势',
  },
  {
    id: 'concept-teardown',
    category: 'knowledge',
    title: '知识点拆解',
    description: '把一个概念拆成定义、误区、例子和行动。',
    output: '适合收藏',
    badge: '知识',
  },
  {
    id: 'method-summary',
    category: 'knowledge',
    title: '方法论总结',
    description: '把经验整理成步骤、检查项和复盘问题。',
    output: '步骤清晰',
    badge: '方法',
  },
  {
    id: 'mental-upgrade',
    category: 'opinion',
    title: '认知升级',
    description: '把普通观点升级成有判断、有边界的表达。',
    output: '观点卡',
    badge: '观点',
  },
  {
    id: 'counter-intuitive',
    category: 'opinion',
    title: '反常识观点',
    description: '用反差切入，给出可信解释和明确结论。',
    output: '强 Hook',
    badge: '冲突',
  },
  {
    id: 'wechat-hook-cover',
    category: 'cover',
    title: '标题党封面',
    description: '大标题优先，副标题补充利益点。',
    output: '封面模式',
    badge: '封面',
  },
  {
    id: 'brand-cover',
    category: 'cover',
    title: '品牌封面',
    description: '更克制的公众号封面，适合品牌号和专栏。',
    output: '排版系统',
    badge: '品牌',
  },
];

const baseCards: ContentCard[] = [
  {
    id: 'cover',
    label: '封面',
    title: 'OpenAI Codex 做了什么？',
    body: '这次更新不简单',
  },
  {
    id: 'card-1',
    label: '卡片 1',
    title: '发生了什么',
    body: 'Codex 正式集成进 ChatGPT',
  },
  {
    id: 'card-2',
    label: '卡片 2',
    title: '核心变化',
    body: '从“建议”变成“执行”',
  },
  {
    id: 'card-3',
    label: '卡片 3',
    title: '为什么重要',
    body: 'AI 开始接管开发流程',
  },
  {
    id: 'card-4',
    label: '卡片 4',
    title: '结论',
    body: '会用 AI 的人胜出',
  },
];

const runSteps = ['提取核心信息', '构建内容结构', '优化封面 Hook', '生成卡片文案'];

export function SkillsPrototype() {
  const [view, setView] = useState<View>('feed');
  const [activeCategory, setActiveCategory] = useState<CategoryId>('news');
  const [input, setInput] = useState('OpenAI Codex 最近发布了什么？');
  const [selectedSkill, setSelectedSkill] = useState<Skill>(skills[0]);
  const [stepIndex, setStepIndex] = useState(0);
  const [cards, setCards] = useState<ContentCard[]>(baseCards);
  const [selectedCardId, setSelectedCardId] = useState(baseCards[0].id);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(baseCards[0].body);
  const [tone, setTone] = useState<CardTone>('impact');
  const [cardTheme, setCardTheme] = useState<CoverTheme>('light');
  const [coverTitle, setCoverTitle] = useState('AI 编程时代来了');
  const [coverSubtitle, setCoverSubtitle] = useState('开发者必须知道的变化');
  const [coverTheme, setCoverTheme] = useState<CoverTheme>('tech');
  const [coverAlign, setCoverAlign] = useState<CoverAlign>('center');
  const [toast, setToast] = useState('');

  const groupedSkills = useMemo(
    () => categories.map((category) => ({
      ...category,
      skills: skills.filter((skill) => skill.category === category.id),
    })),
    [],
  );

  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? cards[0];

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (view !== 'running') return;
    setStepIndex(0);
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= runSteps.length - 1) {
          window.clearInterval(timer);
          window.setTimeout(() => setView('result'), 520);
          return current;
        }
        return current + 1;
      });
    }, 620);
    return () => window.clearInterval(timer);
  }, [view, selectedSkill.id]);

  useEffect(() => {
    if (!selectedCard) return;
    setEditText(selectedCard.body);
  }, [selectedCard?.id, selectedCard?.body]);

  function runSkill(skill: Skill) {
    setSelectedSkill(skill);
    if (skill.category === 'cover') {
      setView('cover');
      return;
    }
    setView('running');
  }

  function saveEdit(nextText = editText) {
    setCards((current) =>
      current.map((card) => (card.id === selectedCard.id ? { ...card, body: nextText } : card)),
    );
    setEditText(nextText);
    setEditOpen(false);
    setToast('已保存到当前卡片');
  }

  function enhanceText(mode: CardTone) {
    setTone(mode);
    const variants: Record<CardTone, string> = {
      plain: 'AI 已经开始进入真实开发流程',
      pro: 'AI 正在从辅助建议走向任务执行层',
      impact: 'AI 开始接管开发流程',
    };
    setEditText(variants[mode]);
  }

  return (
    <main className="skillflow">
      <header className="skillflow-topbar">
        <button className="wordmark" onClick={() => setView('feed')}>Content Cards</button>
        <nav>
          <button className={view === 'feed' ? 'toplink is-active' : 'toplink'} onClick={() => setView('feed')}>Skills</button>
          <button className={view === 'result' ? 'toplink is-active' : 'toplink'} onClick={() => setView('result')}>结果</button>
          <button className={view === 'cover' ? 'toplink is-active' : 'toplink'} onClick={() => setView('cover')}>公众号封面</button>
        </nav>
      </header>

      {view === 'feed' && (
        <section className="feed-page">
          <div className="feed-hero">
            <div>
              <span className="eyebrow">One chat, create content cards</span>
              <h1>选一个创作任务，直接出信息卡片</h1>
            </div>
            <div className="composer">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} />
              <div className="composer-foot">
                <span>输入你要表达的内容</span>
                <button onClick={() => runSkill(selectedSkill)}>用当前 Skill 生成</button>
              </div>
            </div>
          </div>

          <div className="category-tabs">
            {categories.map((category) => (
              <button
                className={activeCategory === category.id ? 'is-active' : ''}
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="feed-sections">
            {groupedSkills.map((group) => (
              <section className={group.id === activeCategory ? 'feed-section is-highlighted' : 'feed-section'} key={group.id}>
                <h2>{group.title}</h2>
                <div className="skill-grid">
                  {group.skills.map((skill) => (
                    <article
                      className={selectedSkill.id === skill.id ? 'task-card is-selected' : 'task-card'}
                      key={skill.id}
                      onClick={() => setSelectedSkill(skill)}
                    >
                      <div className="task-card-head">
                        <span>{skill.badge}</span>
                        <small>{skill.output}</small>
                      </div>
                      <h3>{skill.title}</h3>
                      <p>{skill.description}</p>
                      <button onClick={(event) => {
                        event.stopPropagation();
                        runSkill(skill);
                      }}>
                        生成
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}

      {view === 'running' && (
        <section className="run-page">
          <div className="run-card">
            <button className="back-link" onClick={() => setView('feed')}>切换 Skill</button>
            <span className="eyebrow">Skill</span>
            <h1>{selectedSkill.title}</h1>
            <div className="input-quote">{input}</div>
            <div className="run-steps">
              {runSteps.map((step, index) => (
                <div className={index <= stepIndex ? 'run-step is-done' : 'run-step'} key={step}>
                  <span>{index <= stepIndex ? '✓' : index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
            <div className="loading-bar"><span style={{ width: `${((stepIndex + 1) / runSteps.length) * 100}%` }} /></div>
            <button className="quiet-button" onClick={() => setView('feed')}>取消</button>
          </div>
        </section>
      )}

      {view === 'result' && (
        <section className="result-page">
          <div className="result-main">
            <div className="result-title">
              <span className="eyebrow">{selectedSkill.title}</span>
              <h1>生成结果</h1>
            </div>
            <div className="info-card-stream">
              {cards.map((card) => (
                <article
                  className={selectedCard.id === card.id ? `info-card ${cardTheme} is-active` : `info-card ${cardTheme}`}
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                >
                  <span>{card.label}</span>
                  <h2>{card.title}</h2>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
            <div className="export-bar">
              <button onClick={() => setToast('导出图片：设计稿占位')}>导出图片</button>
              <button onClick={() => setToast('导出长图：设计稿占位')}>导出长图</button>
              <button onClick={() => {
                void navigator.clipboard?.writeText(cards.map((card) => `${card.title}\n${card.body}`).join('\n\n'));
                setToast('已复制文本');
              }}>
                复制文本
              </button>
            </div>
          </div>

          <aside className="result-actions">
            <span className="eyebrow">轻编辑</span>
            <h2>{selectedCard.label}</h2>
            <button onClick={() => setEditOpen(true)}>改文案</button>
            <button onClick={() => {
              setEditOpen(true);
              enhanceText('impact');
            }}>
              增强情绪
            </button>
            <button onClick={() => setToast('已重新生成本卡文案占位')}>重新生成本卡</button>
            <div className="style-switch">
              <span>风格</span>
              <button className={cardTheme === 'light' ? 'is-active' : ''} onClick={() => setCardTheme('light')}>浅色</button>
              <button className={cardTheme === 'dark' ? 'is-active' : ''} onClick={() => setCardTheme('dark')}>深色</button>
              <button className={cardTheme === 'tech' ? 'is-active' : ''} onClick={() => setCardTheme('tech')}>科技感</button>
            </div>
          </aside>

          {editOpen && (
            <aside className="edit-drawer">
              <button className="drawer-close" onClick={() => setEditOpen(false)}>关闭</button>
              <span className="eyebrow">编辑卡片</span>
              <h2>{selectedCard.title}</h2>
              <label>
                <span>文本</span>
                <textarea value={editText} onChange={(event) => setEditText(event.target.value)} />
              </label>
              <div className="tone-row">
                <button className={tone === 'plain' ? 'is-active' : ''} onClick={() => enhanceText('plain')}>更通俗</button>
                <button className={tone === 'pro' ? 'is-active' : ''} onClick={() => enhanceText('pro')}>更专业</button>
                <button className={tone === 'impact' ? 'is-active' : ''} onClick={() => enhanceText('impact')}>更有冲击力</button>
              </div>
              <div className="version-list">
                {['AI 开始进入真实工作流', '开发方式正在被 AI 重写', 'AI 开始接管开发流程'].map((version) => (
                  <button key={version} onClick={() => setEditText(version)}>{version}</button>
                ))}
              </div>
              <button className="save-edit" onClick={() => saveEdit()}>保存</button>
            </aside>
          )}
        </section>
      )}

      {view === 'cover' && (
        <section className="cover-page">
          <div className="cover-form">
            <span className="eyebrow">公众号封面生成</span>
            <h1>文字优先的封面排版</h1>
            <label>
              <span>标题</span>
              <input value={coverTitle} onChange={(event) => setCoverTitle(event.target.value)} />
            </label>
            <label>
              <span>副标题</span>
              <input value={coverSubtitle} onChange={(event) => setCoverSubtitle(event.target.value)} />
            </label>
          </div>
          <div className={`cover-preview ${coverTheme} align-${coverAlign}`}>
            <h2>{coverTitle}</h2>
            <p>{coverSubtitle}</p>
          </div>
          <aside className="cover-tools">
            <label>
              <span>对齐</span>
              <select value={coverAlign} onChange={(event) => setCoverAlign(event.target.value as CoverAlign)}>
                <option value="center">居中</option>
                <option value="left">左对齐</option>
              </select>
            </label>
            <div className="style-switch">
              <span>背景</span>
              <button className={coverTheme === 'light' ? 'is-active' : ''} onClick={() => setCoverTheme('light')}>浅色</button>
              <button className={coverTheme === 'dark' ? 'is-active' : ''} onClick={() => setCoverTheme('dark')}>深色</button>
              <button className={coverTheme === 'tech' ? 'is-active' : ''} onClick={() => setCoverTheme('tech')}>科技感</button>
            </div>
            <button onClick={() => setToast('背景重新生成：设计稿占位')}>重新生成背景</button>
            <button onClick={() => setToast('上传背景：设计稿占位')}>上传背景</button>
            <button className="download-button" onClick={() => setToast('下载 PNG：设计稿占位')}>下载 PNG</button>
          </aside>
        </section>
      )}

      {toast && <div className="skill-toast">{toast}</div>}
    </main>
  );
}
