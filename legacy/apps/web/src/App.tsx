import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  IMAGE_STYLES,
  TEMPLATES,
  THEMES,
  getTheme as getThemeFromSpec,
  resolveTemplate,
  type CardLayout as LayoutId,
  type TemplateSpec,
  type ThemeId,
  type ThemePalette as Theme,
} from '@vcard/shared-types';
import { api, ApiError } from './lib/api';
import { cardToFrontend, langToBackend, sizeToBackend, type FrontendCard } from './lib/adapters';
import {
  buildDeckUpdatePayload,
  chatTargetLabel,
  computeImageJobProgress,
  currentDeckTitle,
  humanizeApiError,
  snapshotToStatePatch,
  type CardJobState,
} from './lib/state';
import { eyebrowFor } from './lib/eyebrow';
import { getUserId } from './lib/user-id';

type Mode = 'html' | 'image';
type StepId = 0 | 1 | 2 | 3 | 4;
type SizeId = '1-1' | '4-5' | '9-16';
type DensityId = 'compact' | 'standard' | 'detailed' | 'rich';

type CardItem = FrontendCard;

type AppState = {
  deckId: string | null;
  mode: Mode;
  count: number;
  size: SizeId;
  template: string;
  lang: string;
  prompt: string;
  outline: CardItem[];
  density: DensityId;
  theme: ThemeId;
  layout: string;
  imageStyle: string;
};

type ChatAction = {
  label: string;
  kind: 'title' | 'bullet' | 'tone';
  applied?: boolean;
  patch?: { title?: string; bullets?: string[] };
};

type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  body: string;
  target?: string;
  actions?: ChatAction[];
};

const steps: Array<{ id: StepId; label: string }> = [
  { id: 0, label: '输入' },
  { id: 1, label: '大纲' },
  { id: 2, label: '风格' },
  { id: 3, label: '生成' },
  { id: 4, label: '工作台' },
];

const cardSizes: Array<{ id: SizeId; label: string; ratio: string; icon: IconName }> = [
  { id: '1-1', label: '正方形', ratio: '1:1', icon: 'square' },
  { id: '4-5', label: '纵向', ratio: '4:5', icon: 'portrait' },
  { id: '9-16', label: '故事', ratio: '9:16', icon: 'story' },
];

const countOptions = [3, 5, 7, 10, 12];

const themes = THEMES;
const imageStyles = IMAGE_STYLES;

const samplePrompt = '帮我介绍 OpenAI Codex 最近两周发布的新能力';

const baseOutline: CardItem[] = [
  {
    id: 'c1',
    title: 'OpenAI Codex：重新定义编程的未来',
    bullets: ['把自然语言任务变成可验证的代码改动', '适合做新功能、修 bug、补测试和生成 PR'],
    layout: 'cover',
  },
  {
    id: 'c2',
    title: '云端原生代理',
    bullets: ['运行在隔离环境里，不占用本地电脑', '能读写仓库、跑测试、解释改动原因'],
    layout: 'list',
  },
  {
    id: 'c3',
    title: '并行任务处理',
    bullets: ['一个问题拆成多个分支同时推进', '适合探索方案、修不同模块、并行验证风险'],
    layout: 'list',
  },
  {
    id: 'c4',
    title: '从想法到可 review 的差异',
    bullets: ['不是只给代码片段，而是把文件改到可运行状态', '最终交付包含变更说明和验证结果'],
    layout: 'quote',
  },
  {
    id: 'c5',
    title: '更像团队里的工程同事',
    bullets: ['会先读代码，再按项目模式实现', '遇到约束会解释取舍，而不是盲目改动'],
    layout: 'list',
  },
  {
    id: 'c6',
    title: '对内容创作的启发',
    bullets: ['把“AI 工具能力”讲成用户能理解的工作流', '每张卡只承担一个观点，降低阅读成本'],
    layout: 'stat',
  },
  {
    id: 'c7',
    title: '一句话总结',
    bullets: ['Codex 让软件工作从“请求建议”进入“委托执行”阶段', '下一步是学会把任务拆得足够清楚'],
    layout: 'closer',
  },
];

const suggestions: Array<{ icon: IconName; text: string }> = [
  { icon: 'bulb', text: '顶级创作者每天第一小时要做的事' },
  { icon: 'user', text: '给知识博主的 7 张选题卡片' },
  { icon: 'chart', text: '职业倦怠的 3 个信号，以及如何处理' },
  { icon: 'file', text: '一篇研究论文如何拆成小红书卡片' },
  { icon: 'mail', text: '你的邮件习惯正在拖慢团队协作' },
  { icon: 'brain', text: '把复杂概念讲清楚的 5 个版式' },
];

const initialState: AppState = {
  deckId: null,
  mode: 'html',
  count: 7,
  size: '4-5',
  template: '极简专业',
  lang: '简体中文',
  prompt: samplePrompt,
  outline: baseOutline,
  density: 'standard',
  theme: 'mono',
  layout: '自动匹配',
  imageStyle: 'editorial',
};

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

export default function App() {
  const [showLanding, setShowLanding] = useState(() => window.location.hash !== '#app');
  const [step, setStep] = useState<StepId>(0);
  const [maxStep, setMaxStep] = useState<StepId>(0);
  const [state, setState] = useState<AppState>(() => loadDraft() ?? initialState);
  const [hydrating, setHydrating] = useState(() => Boolean(loadDraft()?.deckId));
  const hydrationStartedRef = useRef(false);
  const [decks, setDecks] = useState<Array<{ id: string; title: string; updatedAt: string | Date }>>([]);

  const refreshDeckList = () => {
    api
      .listDecks(getUserId())
      .then((res) => {
        setDecks(res.decks.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt })));
      })
      .catch((err) => console.warn('[listDecks]', err));
  };

  useEffect(() => {
    refreshDeckList();
  }, [state.deckId]);

  const switchDeck = async (deckId: string) => {
    if (deckId === state.deckId) return;
    setHydrating(true);
    try {
      const snapshot = await api.getDeck(deckId);
      setState((current) => ({ ...current, ...snapshotToStatePatch(snapshot) }));
      setStep(4);
      setMaxStep(4);
    } catch (err) {
      console.warn('[switchDeck]', err);
    } finally {
      setHydrating(false);
    }
  };

  useEffect(() => {
    window.localStorage.setItem('vcard-web-draft', JSON.stringify(state));
  }, [state]);

  // 启动时如果本地草稿带 deckId，先用后端最新 snapshot 校准
  useEffect(() => {
    if (hydrationStartedRef.current) return;
    hydrationStartedRef.current = true;
    const draft = loadDraft();
    if (!draft?.deckId) return;
    api
      .getDeck(draft.deckId)
      .then((snapshot) => {
        setState((current) => ({ ...current, ...snapshotToStatePatch(snapshot) }));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          console.warn('[hydration] deck not found, clearing draft');
          window.localStorage.removeItem('vcard-web-draft');
          setState(initialState);
        } else {
          console.warn('[hydration] failed, keeping local draft', err);
        }
      })
      .finally(() => setHydrating(false));
  }, []);

  useDeckSettingsSync(state);

  const patchState = (patch: Partial<AppState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const goTo = (next: StepId) => {
    setStep(next);
    setMaxStep((current) => (next > current ? next : current));
  };

  const reset = () => {
    setStep(0);
    setMaxStep(0);
    setState(initialState);
    window.localStorage.removeItem('vcard-web-draft');
  };

  const startWorkspace = () => {
    window.history.replaceState(null, '', '#app');
    setShowLanding(false);
  };

  const goHome = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setShowLanding(true);
  };

  useEffect(() => {
    const onHashChange = () => {
      setShowLanding(window.location.hash !== '#app');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (showLanding) {
    return <LandingPage onStart={startWorkspace} />;
  }

  return (
    <div className="app-root" data-hydrating={hydrating || undefined}>
      <TopNav
        step={step}
        maxStep={maxStep}
        onStep={goTo}
        onReset={reset}
        onHome={goHome}
        hydrating={hydrating}
        decks={decks}
        currentDeckId={state.deckId}
        currentTitle={currentDeckTitle(state, decks)}
        onSwitchDeck={switchDeck}
      />
      <main className="page-stage">
        {step === 0 && <PageInput state={state} set={patchState} onNext={() => goTo(1)} />}
        {step === 1 && <PageOutline state={state} set={patchState} onBack={() => goTo(0)} onNext={() => goTo(2)} />}
        {step === 2 && <PageStyle state={state} set={patchState} onBack={() => goTo(1)} onNext={() => goTo(3)} />}
        {step === 3 && <PageLoading state={state} set={patchState} onDone={() => goTo(4)} onBack={() => goTo(2)} />}
        {step === 4 && <PageStudio state={state} set={patchState} onBack={() => goTo(2)} />}
      </main>
    </div>
  );
}

function useDeckSettingsSync(state: AppState) {
  const lastSentRef = useRef<string>('');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!state.deckId) {
      lastSentRef.current = '';
      initializedRef.current = false;
      return;
    }
    const payload = buildDeckUpdatePayload(state);
    const serialized = JSON.stringify(payload);
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSentRef.current = serialized;
      return;
    }
    if (serialized === lastSentRef.current) return;

    const handle = window.setTimeout(() => {
      lastSentRef.current = serialized;
      api.updateDeck(state.deckId!, payload).catch((err) => {
        console.warn('[updateDeck]', err);
      });
    }, 700);
    return () => window.clearTimeout(handle);
  }, [
    state.deckId,
    state.mode,
    state.count,
    state.size,
    state.lang,
    state.prompt,
    state.template,
    state.theme,
    state.density,
    state.layout,
    state.imageStyle,
  ]);
}

function LandingPage({ onStart: _onStart }: { onStart?: () => void }) {
  const platforms = ['小红书', '微信·小绿书', '即刻', '公众号', 'X / Twitter'];

  const showcaseTemplates: Array<{ src: string; label: string; meta: string }> = [
    { src: '/templates/t1-technical.png', label: 'Technical · 切开式架构', meta: 'engineering-paper · editorial-artifact' },
    { src: '/templates/t2-bold.png', label: 'Bold · 观点海报', meta: 'bold-editorial · swiss-poster' },
    { src: '/templates/t3-news.png', label: 'News · 事故发布', meta: 'newsroom-paper · newsroom-poster' },
    { src: '/templates/t4-archive.png', label: 'Archive · 档案考据', meta: 'kraft-editorial · field-notes' },
    { src: '/templates/t5-product.png', label: 'Product · 组件标本', meta: 'product-manual · product-catalog' },
    { src: '/templates/t7-data.png', label: 'Data · 单数字海报', meta: 'quiet-report · data-poster' },
  ];

  const installSteps: Array<{ num: string; title: string; body: string; icon: IconName }> = [
    { num: '01', title: '获取', body: 'clone 仓库，skills/ 下是两个目录：text-card-generator 与 image-card-generator。', icon: 'download' },
    { num: '02', title: '放进 skills 目录', body: '软链接或拷贝到你 agent 的 skills 目录。Codex 读 ~/.codex/skills/，仓库内项目级读 .agents/skills/ 或 .claude/skills/。', icon: 'layers' },
    { num: '03', title: '在 agent 里触发', body: '直接说要做什么，例如「用 text-card-generator 把这篇文章做成 9 张 3:4 的卡」。', icon: 'sparkle' },
  ];

  const installCommand = `# 1. 获取 skills（任意目录）
git clone 本仓库
cd vcard

# 2a. Codex 全局可用：软链接到 ~/.codex/skills/
mkdir -p ~/.codex/skills
ln -s "$(pwd)/skills/text-card-generator"  ~/.codex/skills/text-card-generator
ln -s "$(pwd)/skills/image-card-generator" ~/.codex/skills/image-card-generator

# 2b. 或：只在某个项目里可用（项目级 skills 目录）
#     很多通用 agent 读 .agents/skills/，Claude Code 读 .claude/skills/
mkdir -p /path/to/your-project/.agents/skills
cp -R skills/text-card-generator  /path/to/your-project/.agents/skills/
cp -R skills/image-card-generator /path/to/your-project/.agents/skills/

# 3. 在你的 agent 里触发（自然语言即可）
#   "用 text-card-generator 把 ./article.md 做成 9 张 3:4 的卡"
#   "用 image-card-generator 给这个主题做 5 张 4:5 的图片卡"`;

  const faqs: Array<{ q: string; a: string }> = [
    {
      q: '需要哪个 agent？',
      a: '任意能读取本地 skills 目录、能跑 shell 的 coding agent。Codex 读 ~/.codex/skills/，Claude Code 读 .claude/skills/，很多通用 agent 读项目内 .agents/skills/。',
    },
    {
      q: '需要 API key 吗？',
      a: 'text-card-generator 不需要，纯本地 HTML/CSS + Playwright。image-card-generator 需要 GPT-image-2 的访问凭证（按 skill 文档配置）。',
    },
    {
      q: '卡片生成在哪？',
      a: '在你本地仓库目录里（如 cards/<主题>/ 或 image-cards/<主题>/），文案、版式、主题都能让 agent 继续改。',
    },
  ];

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <a className="brand-logo-link brand-lockup brand-lockup-landing" href="/" aria-label="vCard">
              <img src="/vcard-d-iconmark.svg" alt="" className="brand-iconmark" />
              <span className="brand-word">vCard</span>
            </a>
          </div>
          <nav className="landing-nav-links" aria-label="页面导航">
            <a href="#showcase">范例</a>
            <a href="#install">安装</a>
            <a href="#faq">常见问题</a>
          </nav>
          <div className="landing-nav-actions">
            <a className="landing-nav-link landing-nav-cta" href="#install">
              安装 skill
              <Icon name="arrowRight" size={13} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-copy">
              <p className="landing-kicker">社媒卡片生成 skill</p>
              <h1>
                <span>一篇文章</span>
                <em><b aria-hidden="true">→</b> 一组卡片</em>
              </h1>
              <p>
                封面卡、要点卡、金句卡，自动排好，直接发小红书、即刻、X。
              </p>
              <div className="landing-platforms" aria-label="支持的平台">
                <ul>
                  {platforms.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
              <div className="landing-actions">
                <a className="btn btn-accent" href="#install">
                  安装 skill
                  <Icon name="arrowRight" size={15} />
                </a>
                <a className="btn btn-outline" href="#showcase">
                  看范例
                </a>
              </div>
            </div>

            <div className="landing-visual" aria-hidden="true">
              <div className="landing-card-collage">
                <span className="landing-count-badge">7 cards</span>
                <article className="landing-card-sheet sheet-one">
                  <span>VCARD · 大纲</span>
                  <b>Codex 新能力</b>
                  <i />
                  <i />
                  <i />
                </article>
                <article className="landing-card-sheet sheet-two">
                  <span>VCARD · 要点</span>
                  <b>工作流变化</b>
                </article>
                <article className="landing-hero-card">
                  <div className="landing-card-mark">V</div>
                  <p>VCARD · 封面</p>
                  <h2>OpenAI Codex<br />最近两周的新能力</h2>
                  <div className="landing-card-progress">
                    <span>01 / 07</span>
                    <i />
                  </div>
                </article>
                <div className="landing-generated-toast">
                  <span className="assistant-avatar">v</span>
                  已生成 7 张，可直接发布 ✓
                </div>
              </div>
            </div>

            <dl className="landing-stats" aria-label="关键指标">
              <div>
                <dt>2 个</dt>
                <dd>安装即用的 skill</dd>
              </div>
              <div>
                <dt>模板丰富</dt>
                <dd>主题 × 设计语言，几千种组合</dd>
              </div>
              <div>
                <dt>多比例</dt>
                <dd>1:1 · 3:4 · 9:16 及自定义</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="landing-showcase" id="showcase" aria-label="成品范例">
          <header className="landing-section-head">
            <p className="eyebrow">成品范例</p>
            <h2>这些都是 skill 跑出来的</h2>
            <p>每个主题预设搭一套设计语言：工程纸、观点海报、事故发布、牛皮档案、组件标本、叙事开场、单数字海报、收藏向笔记。同一份内容，换主题不换骨架。</p>
          </header>
          <div className="landing-showcase-row" role="list">
            {showcaseTemplates.map((item) => (
              <article className="landing-showcase-card" role="listitem" key={item.src}>
                <div className="landing-showcase-frame">
                  <img
                    className="landing-showcase-img"
                    src={item.src}
                    alt={`${item.label} 卡片范例`}
                    width={880}
                    height={880}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="landing-showcase-meta">
                  <strong>{item.label}</strong>
                  <span>{item.meta}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-install" id="install" aria-label="安装与使用">
          <header className="landing-section-head">
            <p className="eyebrow">两个 skill · 安装与使用</p>
            <h2>三步装进你的 agent</h2>
            <p>两个 skill 共用同一套主题与设计语言体系，按内容选其一或混用。skills 是普通目录，clone 下来放进你 coding agent 读取的 skills 目录即可，下面以 Codex 为例。</p>
          </header>
          <ul className="landing-install-notes">
            <li>
              <code>text-card-generator</code> —— 用 HTML/CSS + Playwright 渲染确定性文字卡，文案精确、多比例、逐张 QA。
            </li>
            <li>
              <code>image-card-generator</code> —— 用 GPT-image-2 生成信息优先的图片卡，封面主导、单张可重跑。
            </li>
          </ul>
          <ol className="landing-steps">
            {installSteps.map((step) => (
              <li key={step.num}>
                <span className="landing-step-num">{step.num}</span>
                <span className="landing-step-icon">
                  <Icon name={step.icon} size={18} />
                </span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="landing-install-code">
            <div className="landing-install-code-bar">
              <span>shell</span>
            </div>
            <pre>
              <code>{installCommand}</code>
            </pre>
          </div>
        </section>

        <section className="landing-faq" id="faq" aria-label="常见问题">
          <header className="landing-section-head">
            <p className="eyebrow">常见问题</p>
            <h2>装之前先看这三条</h2>
          </header>
          <div className="landing-faq-list">
            {faqs.map((item) => (
              <article className="landing-faq-item" key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-left">
          <span className="brand-lockup brand-lockup-footer" aria-label="vCard">
            <img src="/vcard-d-iconmark.svg" alt="" className="brand-iconmark" />
            <span className="brand-word">vCard</span>
          </span>
          <span className="landing-footer-tag">装进 coding agent 的社媒卡片 skill</span>
        </div>
        <div className="landing-footer-meta">
          <span>© {new Date().getFullYear()} vCard</span>
          <span>·</span>
          <span>卡片尺寸已对齐 小红书 / 微信小绿书 / 即刻 / 公众号</span>
        </div>
      </footer>
    </div>
  );
}

function loadDraft(): AppState | null {
  try {
    const raw = window.localStorage.getItem('vcard-web-draft');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState> & { outline?: CardItem[] };
    if (!Array.isArray(parsed.outline) || parsed.outline.length === 0) return null;
    return { ...initialState, ...parsed, deckId: parsed.deckId ?? null } as AppState;
  } catch {
    return null;
  }
}

function triggerDownload(payload: string, filename: string) {
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function TopNav({
  step,
  maxStep,
  onStep,
  onReset,
  onHome,
  hydrating,
  decks,
  currentDeckId,
  currentTitle,
  onSwitchDeck,
}: {
  step: StepId;
  maxStep: StepId;
  onStep: (step: StepId) => void;
  onReset: () => void;
  onHome: () => void;
  hydrating?: boolean;
  decks: Array<{ id: string; title: string; updatedAt: string | Date }>;
  currentDeckId: string | null;
  currentTitle: string;
  onSwitchDeck: (deckId: string) => void;
}) {
  return (
    <header className="topnav">
      <button className="brand" type="button" onClick={onHome} aria-label="回到首页">
        <span className="brand-lockup brand-lockup-app">
          <img src="/vcard-d-iconmark.svg" alt="" className="brand-iconmark" />
          <span className="brand-word">vCard</span>
        </span>
        <span className="brand-divider">/</span>
      </button>
      <DeckPicker
        decks={decks}
        currentDeckId={currentDeckId}
        currentTitle={currentTitle}
        onSwitchDeck={onSwitchDeck}
        onCreateNew={onReset}
      />

      <nav className="stepper" aria-label="生成流程">
        {steps.map((item, index) => {
          const canJump = item.id <= maxStep;
          const state = step === item.id ? 'active' : step > item.id ? 'done' : 'idle';
          return (
            <div className="step-fragment" key={item.id}>
              <button className="step-pill" data-state={state} type="button" disabled={!canJump} onClick={() => onStep(item.id)}>
                <span className="step-num">{step > item.id ? <Icon name="check" size={11} /> : item.id + 1}</span>
                <span>{item.label}</span>
              </button>
              {index < steps.length - 1 && <span className="step-divider" />}
            </div>
          );
        })}
      </nav>

      <div className="topnav-actions">
        <span className="save-state">{hydrating ? '同步中…' : '已保存'}</span>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onReset}>
          <Icon name="rotate" size={14} />
          新建卡组
        </button>
      </div>
    </header>
  );
}

function DeckPicker({
  decks,
  currentDeckId,
  currentTitle,
  onSwitchDeck,
  onCreateNew,
}: {
  decks: Array<{ id: string; title: string; updatedAt: string | Date }>;
  currentDeckId: string | null;
  currentTitle: string;
  onSwitchDeck: (deckId: string) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const others = decks.filter((d) => d.id !== currentDeckId);
  const formatTime = (value: string | Date) => {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} 天前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="deck-picker" ref={ref}>
      <button className="deck-picker-trigger" type="button" onClick={() => setOpen((v) => !v)} data-open={open}>
        <span className="draft-name">{currentTitle}</span>
        <Icon name="chevron" size={13} />
      </button>
      {open && (
        <div className="deck-picker-menu">
          <div className="dropdown-header">我的卡组（{decks.length}）</div>
          {others.length === 0 ? (
            <div className="deck-picker-empty">暂无其他卡组</div>
          ) : (
            others.map((deck) => (
              <button
                key={deck.id}
                className="deck-picker-item"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSwitchDeck(deck.id);
                }}
              >
                <span className="deck-picker-title">{deck.title}</span>
                <span className="deck-picker-meta">{formatTime(deck.updatedAt)}</span>
              </button>
            ))
          )}
          <div className="deck-picker-footer">
            <button
              className="deck-picker-create"
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
            >
              <Icon name="plus" size={13} />
              新建卡组
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PageInput({ state, set, onNext }: PageProps) {
  const size = cardSizes.find((item) => item.id === state.size) ?? cardSizes[1];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adjustCount = (count: number) => {
    const next = resizeOutline(state.outline, count);
    set({ count, outline: next });
  };

  const handleStart = async () => {
    const prompt = state.prompt.trim();
    if (!prompt || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const snapshot = await api.createDeck({
        userId: getUserId(),
        prompt,
        mode: state.mode,
        cardCount: state.count,
        aspectRatio: sizeToBackend(state.size),
        language: langToBackend(state.lang),
        settings: {
          template: state.template,
          theme: state.theme,
          density: state.density,
          layout: state.layout,
          imageStyle: state.imageStyle,
        },
      });
      const outline = snapshot.cards.map(cardToFrontend);
      set({
        deckId: snapshot.deck.id,
        outline,
        count: outline.length,
      });
      onNext();
    } catch (err) {
      const message = err instanceof ApiError ? humanizeApiError(err) : '生成失败，请稍后重试';
      console.error('[createDeck]', err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page gen-page" aria-labelledby="input-title">
      <div className="hero">
        <p className="eyebrow">vCard workspace</p>
        <h1 id="input-title">生成一套能直接发的小红书 / 小绿书卡片</h1>
        <p className="subtitle">先选输出形态，再给主题。大纲、风格和最终卡片都能在工作台里继续改。</p>
      </div>

      <section className="mode-grid" aria-label="选择生成模式">
        <ModeCard
          mode="html"
          active={state.mode === 'html'}
          title="文字闪卡"
          tag="结构化文字卡"
          description="文字清晰、排版稳定，适合知识科普、观点输出和资讯拆解。"
          meta={['~3s', '文字优先', '可编辑']}
          onSelect={() => set({ mode: 'html' })}
        />
        <ModeCard
          mode="image"
          active={state.mode === 'image'}
          title="GPT-Image-2 图片"
          tag="视觉冲击图"
          description="整图生成并模拟文字烧入，适合热点封面、情绪表达和视觉化叙事。"
          meta={['~30s', '视觉优先', '整图渲染']}
          onSelect={() => set({ mode: 'image' })}
        />
      </section>

      <div className="params-row">
        <PillSelect icon="cards" label={`${state.count} 张卡片`}>
          <DropdownHeader>卡片数量</DropdownHeader>
          {countOptions.map((count) => (
            <DropdownItem key={count} checked={state.count === count} onClick={() => adjustCount(count)}>
              <span>{count} 张卡片</span>
            </DropdownItem>
          ))}
        </PillSelect>

        <PillSelect icon="palette" label={state.template}>
          <DropdownHeader>起始模板</DropdownHeader>
          {TEMPLATES.map((tmpl) => (
            <DropdownItem
              key={tmpl.id}
              checked={state.template === tmpl.name || state.template === tmpl.id}
              onClick={() =>
                set({
                  template: tmpl.name,
                  theme: tmpl.defaultTheme,
                  imageStyle: tmpl.defaultImageStyle,
                })
              }
            >
              <span>{tmpl.name}</span>
              <span className="meta">{tmpl.meta}</span>
            </DropdownItem>
          ))}
        </PillSelect>

        <PillSelect icon={size.icon} label={`${size.label} · ${size.ratio}`}>
          <DropdownHeader>卡片尺寸</DropdownHeader>
          {cardSizes.map((item) => (
            <DropdownItem key={item.id} checked={state.size === item.id} onClick={() => set({ size: item.id })}>
              <Icon name={item.icon} size={14} />
              <span>{item.label}</span>
              <span className="meta">{item.ratio}</span>
            </DropdownItem>
          ))}
        </PillSelect>

        <PillSelect icon="globe" label={state.lang}>
          <DropdownHeader>语言</DropdownHeader>
          {['简体中文', '繁體中文', 'English', '日本語'].map((lang) => (
            <DropdownItem key={lang} checked={state.lang === lang} onClick={() => set({ lang })}>
              <span>{lang}</span>
            </DropdownItem>
          ))}
        </PillSelect>
      </div>

      <div className="prompt-box">
        <label className="sr-only" htmlFor="main-prompt">
          卡片主题
        </label>
        <textarea
          id="main-prompt"
          value={state.prompt}
          maxLength={500}
          rows={3}
          placeholder="描述你想生成的内容..."
          onChange={(event) => set({ prompt: event.target.value })}
        />
        <div className="prompt-actions">
          <span className="prompt-counter">{state.prompt.length} / 500</span>
          <button
            className="btn btn-accent"
            type="button"
            disabled={!state.prompt.trim() || submitting}
            onClick={handleStart}
          >
            <Icon name="sparkle" size={15} />
            {submitting ? '正在生成大纲…' : '开始生成'}
            {!submitting && <Icon name="arrowRight" size={15} />}
          </button>
        </div>
        {error && (
          <div className="prompt-error" role="alert">
            <Icon name="x" size={13} />
            <span>{error}</span>
          </div>
        )}
      </div>

      <section className="suggestions" aria-labelledby="suggestion-title">
        <div className="section-label" id="suggestion-title">
          灵感参考
        </div>
        <div className="suggest-grid">
          {suggestions.map((item) => (
            <button className="suggest-card" type="button" key={item.text} onClick={() => set({ prompt: item.text })}>
              <Icon name={item.icon} size={18} />
              <span>{item.text}</span>
              <Icon name="plus" size={14} />
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function ModeCard({
  mode,
  active,
  title,
  tag,
  description,
  meta,
  onSelect,
}: {
  mode: Mode;
  active: boolean;
  title: string;
  tag: string;
  description: string;
  meta: string[];
  onSelect: () => void;
}) {
  return (
    <button className="mode-card" data-active={active} type="button" onClick={onSelect}>
      <span className="mode-tag">
        <Icon name={mode === 'html' ? 'code' : 'sparkles'} size={13} />
        {tag}
      </span>
      <span className="mode-visual">{mode === 'html' ? <HtmlMiniCard /> : <ImageMiniCard />}</span>
      <strong>{title}</strong>
      <span className="mode-desc">{description}</span>
      <span className="mode-meta">
        {meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </span>
    </button>
  );
}

function PageOutline({ state, set, onBack, onNext }: PageProps & { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const patchTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, { title?: string; bullets?: string[]; layout?: LayoutId }>>(new Map());

  const reportError = (err: unknown, fallback: string) => {
    console.error(fallback, err);
    setError(err instanceof ApiError ? humanizeApiError(err) : fallback);
  };

  const flushCardPatch = async (cardId: string) => {
    const deckId = stateRef.current.deckId;
    if (!deckId) return;
    const patch = pendingPatches.current.get(cardId);
    if (!patch) return;
    pendingPatches.current.delete(cardId);
    const card = stateRef.current.outline.find((item) => item.id === cardId);
    if (!card?.version) return;
    try {
      const updated = await api.patchCard(deckId, cardId, { version: card.version, ...patch });
      const next = stateRef.current.outline.map((item) => (item.id === cardId ? cardToFrontend(updated) : item));
      set({ outline: next });
    } catch (err) {
      reportError(err, '保存卡片失败');
    }
  };

  const scheduleCardPatch = (cardId: string, patch: { title?: string; bullets?: string[]; layout?: LayoutId }) => {
    if (!stateRef.current.deckId) return;
    const merged = { ...(pendingPatches.current.get(cardId) ?? {}), ...patch };
    pendingPatches.current.set(cardId, merged);
    const existing = patchTimers.current.get(cardId);
    if (existing) window.clearTimeout(existing);
    const handle = window.setTimeout(() => flushCardPatch(cardId), 600);
    patchTimers.current.set(cardId, handle);
  };

  useEffect(() => {
    return () => {
      patchTimers.current.forEach((handle) => window.clearTimeout(handle));
    };
  }, []);

  const updateCard = (id: string, patch: Partial<CardItem>) => {
    set({ outline: state.outline.map((card) => (card.id === id ? { ...card, ...patch } : card)) });
    const remote: { title?: string; bullets?: string[]; layout?: LayoutId } = {};
    if (patch.title !== undefined) remote.title = patch.title;
    if (patch.bullets !== undefined) remote.bullets = patch.bullets;
    if (patch.layout !== undefined) remote.layout = patch.layout;
    if (Object.keys(remote).length > 0) scheduleCardPatch(id, remote);
  };

  const updateBullet = (cardId: string, bulletIndex: number, value: string) => {
    const card = state.outline.find((item) => item.id === cardId);
    if (!card) return;
    const bullets = card.bullets.map((bullet, index) => (index === bulletIndex ? value : bullet));
    updateCard(cardId, { bullets });
  };

  const addBullet = (cardId: string) => {
    const card = state.outline.find((item) => item.id === cardId);
    if (!card) return;
    updateCard(cardId, { bullets: [...card.bullets, ''] });
  };

  const removeBullet = (cardId: string, bulletIndex: number) => {
    const card = state.outline.find((item) => item.id === cardId);
    if (!card) return;
    updateCard(cardId, { bullets: card.bullets.filter((_, index) => index !== bulletIndex) });
  };

  const removeCard = async (id: string) => {
    if (state.outline.length <= 1) return;
    const outline = state.outline.filter((card) => card.id !== id);
    set({ outline, count: outline.length });
    if (!state.deckId) return;
    try {
      await api.deleteCard(state.deckId, id);
    } catch (err) {
      reportError(err, '删除卡片失败');
    }
  };

  const addCard = async () => {
    if (!state.deckId) {
      console.warn('[addCard] no deckId, falling back to local-only insert');
      const outline = [
        ...state.outline,
        { id: uid('card'), title: '新卡片标题', bullets: ['补充一个要点'], layout: 'list' as LayoutId },
      ];
      set({ outline, count: outline.length });
      return;
    }
    try {
      const card = await api.createCard(state.deckId, {
        title: '新卡片标题',
        bullets: ['补充一个要点'],
        layout: 'list',
      });
      const outline = [...state.outline, cardToFrontend(card)];
      set({ outline, count: outline.length });
    } catch (err) {
      reportError(err, '新增卡片失败');
    }
  };

  const moveCard = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= state.outline.length) return;
    const outline = [...state.outline];
    const [card] = outline.splice(index, 1);
    outline.splice(target, 0, card);
    set({ outline });
    if (!state.deckId) return;
    try {
      await api.reorderCards(state.deckId, outline.map((item) => item.id));
    } catch (err) {
      reportError(err, '重排失败');
    }
  };

  const regenerateOutline = async () => {
    if (!state.deckId || regenerating) return;
    setRegenerating(true);
    setError(null);
    try {
      const snapshot = await api.upsertOutline(state.deckId, { prompt: state.prompt });
      set(snapshotToStatePatch(snapshot));
    } catch (err) {
      reportError(err, '重新生成大纲失败');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <section className="page outline-page" aria-labelledby="outline-title">
      <PageHeader eyebrow="Step 2" title="编辑大纲" subtitle="每张卡承担一个观点。这里先把标题、要点和顺序定下来。" />

      <div className="outline-toolbar">
        <PillSelect icon="cards" label={`${state.outline.length} 张卡片`}>
          <DropdownHeader>卡片数量</DropdownHeader>
          {countOptions.map((count) => (
            <DropdownItem
              key={count}
              checked={state.outline.length === count}
              onClick={() => set({ count, outline: resizeOutline(state.outline, count) })}
            >
              <span>{count} 张</span>
            </DropdownItem>
          ))}
        </PillSelect>

        <PillSelect icon={state.mode === 'html' ? 'code' : 'sparkles'} label={state.mode === 'html' ? '文字闪卡' : 'GPT-Image 图片'}>
          <DropdownHeader>生成模式</DropdownHeader>
          <DropdownItem checked={state.mode === 'html'} onClick={() => set({ mode: 'html' })}>
            <Icon name="code" size={14} />
            <span>文字闪卡</span>
          </DropdownItem>
          <DropdownItem checked={state.mode === 'image'} onClick={() => set({ mode: 'image' })}>
            <Icon name="sparkles" size={14} />
            <span>GPT-Image 图片</span>
          </DropdownItem>
        </PillSelect>
      </div>

      <div className="outline-prompt">
        <span>Prompt</span>
        <input value={state.prompt} onChange={(event) => set({ prompt: event.target.value })} aria-label="当前 prompt" />
        <button
          className="icon-btn"
          type="button"
          aria-label="重新生成大纲"
          disabled={regenerating || !state.deckId}
          onClick={regenerateOutline}
          title={state.deckId ? '重新生成整套大纲' : '需要先在第 1 步生成卡组'}
        >
          <Icon name="rotate" size={15} />
        </button>
      </div>

      {error && (
        <div className="prompt-error" role="alert">
          <Icon name="x" size={13} />
          <span>{error}</span>
        </div>
      )}
      {regenerating && (
        <div className="outline-banner">正在重新生成大纲，请稍候…</div>
      )}

      <div className="outline-list">
        {state.outline.map((card, index) => (
          <article className="outline-item" key={card.id}>
            <div className="outline-num">{String(index + 1).padStart(2, '0')}</div>
            <div className="outline-content">
              <input className="outline-title" value={card.title} onChange={(event) => updateCard(card.id, { title: event.target.value })} />
              <div className="bullet-editor">
                {card.bullets.map((bullet, bulletIndex) => (
                  <div className="bullet-row" key={`${card.id}_${bulletIndex}`}>
                    <span>{String(bulletIndex + 1).padStart(2, '0')}</span>
                    <input value={bullet} placeholder="要点..." onChange={(event) => updateBullet(card.id, bulletIndex, event.target.value)} />
                    <button className="icon-btn" type="button" aria-label="删除要点" onClick={() => removeBullet(card.id, bulletIndex)}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="text-btn" type="button" onClick={() => addBullet(card.id)}>
                <Icon name="plus" size={13} />
                添加要点
              </button>
            </div>
            <div className="outline-actions">
              <button className="icon-btn" type="button" aria-label="上移" disabled={index === 0} onClick={() => moveCard(index, -1)}>
                <Icon name="arrowUp" size={14} />
              </button>
              <button className="icon-btn" type="button" aria-label="下移" disabled={index === state.outline.length - 1} onClick={() => moveCard(index, 1)}>
                <Icon name="arrowDown" size={14} />
              </button>
              <button className="icon-btn danger" type="button" aria-label="删除卡片" onClick={() => removeCard(card.id)}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </article>
        ))}
        <button className="add-card-btn" type="button" onClick={addCard}>
          <Icon name="plus" size={14} />
          添加卡片
        </button>
      </div>

      <StickyFoot>
        <button className="btn btn-ghost btn-sm invert" type="button" onClick={onBack}>
          <Icon name="arrowLeft" size={14} />
          返回
        </button>
        <span>{state.outline.length} 张卡片 · {state.mode === 'html' ? 'HTML' : 'Image'} 模式</span>
        <button className="btn btn-accent" type="button" onClick={onNext}>
          下一步
          <Icon name="arrowRight" size={14} />
        </button>
      </StickyFoot>
    </section>
  );
}

function PageStyle({ state, set, onBack, onNext }: PageProps & { onBack: () => void }) {
  const theme = getTheme(state.theme);
  const spec = resolveTemplate(state.template);
  const densityOptions: Array<{ id: DensityId; name: string; lines: number }> = [
    { id: 'compact', name: '简约', lines: 2 },
    { id: 'standard', name: '简洁', lines: 3 },
    { id: 'detailed', name: '详细', lines: 4 },
    { id: 'rich', name: '丰富', lines: 5 },
  ];

  return (
    <section className="page style-page" aria-labelledby="style-title">
      <div className="style-main">
        <PageHeader eyebrow="Step 3" title="定制风格" subtitle="把主题色、文字密度和生成风格确定下来。右侧预览会实时同步。" />

        <section className="style-section">
          <h2>
            <Icon name="type" size={17} />
            文本密度
          </h2>
          <p>控制每张卡承载的信息量。</p>
          <div className="density-grid">
            {densityOptions.map((option) => (
              <button
                className="density-card"
                data-active={state.density === option.id}
                type="button"
                key={option.id}
                onClick={() => set({ density: option.id })}
              >
                <span className="density-lines">
                  {Array.from({ length: option.lines }).map((_, index) => (
                    <i key={index} style={{ width: index === option.lines - 1 ? '52%' : '82%' }} />
                  ))}
                </span>
                <span>{option.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="style-section">
          <h2>
            <Icon name="palette" size={17} />
            主题效果
          </h2>
          <p>默认保持黑白灰，只在卡片内容里使用一个强调色。</p>
          <div className="theme-grid">
            {themes.map((item) => {
              const isRecommended = spec.recommendedThemes.includes(item.id);
              return (
                <button
                  className="theme-card"
                  data-active={state.theme === item.id}
                  data-recommended={isRecommended}
                  type="button"
                  key={item.id}
                  onClick={() => set({ theme: item.id })}
                  title={isRecommended ? `「${spec.name}」推荐主题` : undefined}
                >
                  <span className="theme-preview" style={{ background: item.bg, color: item.fg }}>
                    <strong>标题</strong>
                    <span>正文和链接</span>
                    <i style={{ background: item.accent }} />
                  </span>
                  <span className="theme-meta">
                    <span>{item.name}</span>
                    <small>{item.meta}</small>
                  </span>
                  {isRecommended && <span className="theme-recommended">推荐</span>}
                </button>
              );
            })}
          </div>
        </section>

        {state.mode === 'image' ? (
          <section className="style-section">
            <h2>
              <Icon name="image" size={17} />
              图像艺术风格
            </h2>
            <p>选定的风格会传给图像生成，控制整组卡片的视觉方向。</p>
            <div className="image-style-grid">
              {imageStyles.map((item) => {
                const isRecommended = spec.imageStyleBias.includes(item.id);
                return (
                  <button
                    className="image-style-card"
                    data-active={state.imageStyle === item.id}
                    data-recommended={isRecommended}
                    type="button"
                    key={item.id}
                    onClick={() => set({ imageStyle: item.id })}
                    style={{ '--style-color': item.color } as CSSProperties}
                    title={isRecommended ? `「${spec.name}」推荐风格` : undefined}
                  >
                    <span>{item.name}</span>
                    {isRecommended && <small>推荐</small>}
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="style-section">
            <h2>
              <Icon name="layers" size={17} />
              卡片版式
            </h2>
            <p>封面、列表、引言、数据和结尾会按内容自动匹配。</p>
            <div className="chip-row">
              {['自动匹配', '统一列表', '杂志混排', '极简纯文'].map((layout) => (
                <button className="quick-chip" data-active={state.layout === layout} type="button" key={layout} onClick={() => set({ layout })}>
                  {layout}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="preview-pane" aria-label="实时预览">
        <span className="section-label">实时预览</span>
        <CardFrame card={state.outline[Math.min(1, state.outline.length - 1)]} theme={theme} mode={state.mode} size={state.size} density={state.density} total={state.outline.length} index={1} templateSpec={resolveTemplate(state.template)} />
        <p>
          {cardSizes.find((item) => item.id === state.size)?.ratio} · {theme.name} · {densityOptions.find((item) => item.id === state.density)?.name}
        </p>
      </aside>

      <StickyFoot>
        <button className="btn btn-ghost btn-sm invert" type="button" onClick={onBack}>
          <Icon name="arrowLeft" size={14} />
          大纲
        </button>
        <span>{state.outline.length} 张卡片 · 风格已选</span>
        <button className="btn btn-accent" type="button" onClick={onNext}>
          <Icon name="sparkle" size={14} />
          生成
        </button>
      </StickyFoot>
    </section>
  );
}

function PageLoading({
  state,
  set,
  onDone,
  onBack,
}: {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const [fakeProgress, setFakeProgress] = useState(0); // html mode 用
  const [imageProgress, setImageProgress] = useState({ total: 0, done: 0, failed: 0, ratio: 0 });
  const [phase, setPhase] = useState<'submitting' | 'rendering' | 'failed'>('submitting');
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const isImage = state.mode === 'image';

  useEffect(() => {
    if (!state.deckId) {
      console.warn('[PageLoading] no deckId, skipping generate (likely stale draft)');
      onDone();
      return;
    }
    let cancelled = false;
    let pollTimer: number | undefined;
    let fakeTicker: number | undefined;

    setError(null);
    setPhase('submitting');
    setFakeProgress(0);
    setImageProgress({ total: 0, done: 0, failed: 0, ratio: 0 });

    const startFakeProgress = () => {
      fakeTicker = window.setInterval(() => {
        setFakeProgress((current) => (current >= 90 ? current : current + 4));
      }, 280);
    };

    const finalize = async () => {
      // 拉一次最新 deck snapshot，把 imageUrl 写回本地 outline
      try {
        const snapshot = await api.getDeck(state.deckId!);
        if (!cancelled) set(snapshotToStatePatch(snapshot));
      } catch (err) {
        console.warn('[getDeck after generate]', err);
      }
      if (!cancelled) {
        setFakeProgress(100);
        window.setTimeout(() => !cancelled && onDone(), 260);
      }
    };

    const pollImageJob = async (jobId: string) => {
      try {
        const res = await api.getGenerationJob(state.deckId!, jobId);
        if (cancelled) return;
        const cardJobs = (res.job.result as { cardJobs?: CardJobState[] } | null)?.cardJobs;
        const progress = computeImageJobProgress(cardJobs);
        setImageProgress({
          total: progress.total,
          done: progress.done,
          failed: progress.failed,
          ratio: progress.ratio,
        });
        if (progress.isComplete || res.job.status === 'done' || res.job.status === 'failed') {
          if (progress.failed > 0) {
            setError(`${progress.failed} / ${progress.total} 张图片生成失败，已保留其余卡片。`);
          }
          await finalize();
          return;
        }
        pollTimer = window.setTimeout(() => pollImageJob(jobId), 1500);
      } catch (err) {
        if (cancelled) return;
        console.error('[poll job]', err);
        setError(err instanceof ApiError ? humanizeApiError(err) : '查询进度失败');
        setPhase('failed');
      }
    };

    if (!isImage) startFakeProgress();

    api
      .generate(state.deckId, { mode: state.mode })
      .then(async (result) => {
        if (cancelled) return;
        if (isImage) {
          setPhase('rendering');
          await pollImageJob(result.job.id);
        } else {
          if (fakeTicker) window.clearInterval(fakeTicker);
          set(snapshotToStatePatch(result.deck));
          setFakeProgress(100);
          window.setTimeout(() => !cancelled && onDone(), 260);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (fakeTicker) window.clearInterval(fakeTicker);
        console.error('[generate]', err);
        setError(err instanceof ApiError ? humanizeApiError(err) : '生成失败');
        setPhase('failed');
      });

    return () => {
      cancelled = true;
      if (fakeTicker) window.clearInterval(fakeTicker);
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [state.deckId, state.mode, retryToken]);

  const displayedProgress = isImage
    ? Math.round(imageProgress.ratio * 100)
    : Math.round(fakeProgress);

  const stepLabel = isImage
    ? phase === 'submitting'
      ? '提交生成请求'
      : imageProgress.total === 0
        ? '准备图像任务'
        : `图片 ${imageProgress.done}/${imageProgress.total}` +
          (imageProgress.failed > 0 ? ` · 失败 ${imageProgress.failed}` : '')
    : fakeProgress < 100
      ? '后端渲染卡片'
      : '完成';

  return (
    <section className="page loading-page" aria-live="polite">
      <div className="loading-stack" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <h1>正在生成 {state.outline.length} 张{isImage ? ' AI 图片' : ' 文字闪卡'}</h1>
      <p>
        {isImage
          ? '占位图（SVG）会立即返回；接入 OPENAI_API_KEY 后会跑真实 gpt-image-1，单张约 30s。'
          : '后端正在渲染整套卡片快照。'}
      </p>
      <div className="loading-progress">
        <i style={{ width: `${displayedProgress}%` }} />
      </div>
      <div className="loading-step">{stepLabel}</div>
      {error && (
        <div className="prompt-error" role="alert">
          <Icon name="x" size={13} />
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRetryToken((token) => token + 1)}>
            <Icon name="rotate" size={13} />
            重试
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
            <Icon name="arrowLeft" size={13} />
            返回风格
          </button>
        </div>
      )}
    </section>
  );
}

function PageStudio({ state, set, onBack }: { state: AppState; set: (patch: Partial<AppState>) => void; onBack: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [chatTarget, setChatTarget] = useState<number | null>(0);
  const [draft, setDraft] = useState('');
  const [directEdit, setDirectEdit] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid('msg'),
      role: 'ai',
      body: `已生成 ${state.outline.length} 张卡片。左侧切换卡片，右侧对话会默认锁定当前卡。`,
    },
  ]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const theme = getTheme(state.theme);
  const spec = resolveTemplate(state.template);
  const activeCard = state.outline[Math.min(activeIndex, state.outline.length - 1)];

  // 卡片 PATCH 调度器
  const stateRef = useRef(state);
  stateRef.current = state;
  const patchTimers = useRef<Map<string, number>>(new Map());
  const pendingPatches = useRef<Map<string, { title?: string; bullets?: string[]; layout?: LayoutId }>>(new Map());

  const flushCardPatch = async (cardId: string) => {
    const deckId = stateRef.current.deckId;
    if (!deckId) return;
    const patch = pendingPatches.current.get(cardId);
    if (!patch) return;
    pendingPatches.current.delete(cardId);
    const card = stateRef.current.outline.find((item) => item.id === cardId);
    if (!card?.version) return;
    try {
      const updated = await api.patchCard(deckId, cardId, { version: card.version, ...patch });
      const next = stateRef.current.outline.map((item) => (item.id === cardId ? cardToFrontend(updated) : item));
      set({ outline: next });
    } catch (err) {
      console.error('[patchCard]', err);
      setError(err instanceof ApiError ? humanizeApiError(err) : '保存失败');
    }
  };

  const scheduleCardPatch = (cardId: string, patch: { title?: string; bullets?: string[]; layout?: LayoutId }) => {
    if (!stateRef.current.deckId) return;
    const merged = { ...(pendingPatches.current.get(cardId) ?? {}), ...patch };
    pendingPatches.current.set(cardId, merged);
    const existing = patchTimers.current.get(cardId);
    if (existing) window.clearTimeout(existing);
    const handle = window.setTimeout(() => flushCardPatch(cardId), 600);
    patchTimers.current.set(cardId, handle);
  };

  useEffect(() => () => {
    patchTimers.current.forEach((h) => window.clearTimeout(h));
  }, []);

  // 进入工作台拉聊天历史
  useEffect(() => {
    if (!state.deckId) return;
    let cancelled = false;
    api
      .getChat(state.deckId)
      .then((res) => {
        if (cancelled) return;
        const outline = stateRef.current.outline;
        const fromBackend = res.messages.map((msg) => ({
          id: msg.id,
          role: (msg.role === 'assistant' ? 'ai' : 'user') as 'ai' | 'user',
          body: msg.body,
          target: chatTargetLabel(msg.cardId, outline),
          actions: msg.actions?.length ? msg.actions.map((a) => ({ ...a })) : undefined,
        }));
        if (fromBackend.length > 0) setMessages(fromBackend);
      })
      .catch((err) => console.warn('[getChat]', err));
    return () => {
      cancelled = true;
    };
  }, [state.deckId]);

  useEffect(() => {
    setChatTarget(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  const updateCardAt = (index: number, patch: Partial<CardItem>) => {
    const card = state.outline[index];
    if (!card) return;
    const outline = state.outline.map((c, i) => (i === index ? { ...c, ...patch } : c));
    set({ outline });
    const remote: { title?: string; bullets?: string[]; layout?: LayoutId } = {};
    if (patch.title !== undefined) remote.title = patch.title;
    if (patch.bullets !== undefined) remote.bullets = patch.bullets;
    if (patch.layout !== undefined) remote.layout = patch.layout;
    if (Object.keys(remote).length > 0) scheduleCardPatch(card.id, remote);
  };

  const addCard = async () => {
    if (!state.deckId) {
      console.warn('[studio addCard] no deckId, falling back to local-only insert');
      const outline = [
        ...state.outline,
        { id: uid('card'), title: '新卡片', bullets: ['补充一个要点'], layout: 'list' as LayoutId },
      ];
      set({ outline, count: outline.length });
      setActiveIndex(outline.length - 1);
      return;
    }
    try {
      const card = await api.createCard(state.deckId, {
        title: '新卡片',
        bullets: ['补充一个要点'],
        layout: 'list',
      });
      const outline = [...state.outline, cardToFrontend(card)];
      set({ outline, count: outline.length });
      setActiveIndex(outline.length - 1);
    } catch (err) {
      console.error('[createCard]', err);
      setError(err instanceof ApiError ? humanizeApiError(err) : '新增卡片失败');
    }
  };

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    const target = chatTargetLabel(chatTarget === null ? null : state.outline[chatTarget]?.id ?? null, state.outline);
    setDraft('');

    if (!state.deckId) {
      console.warn('[sendMessage] no deckId, chat is offline-only');
      setMessages((current) => [
        ...current,
        { id: uid('msg'), role: 'user', body: content, target },
        { id: uid('msg'), role: 'ai', body: '当前未连接后端，无法对话编辑。', target },
      ]);
      return;
    }

    const optimisticUser: ChatMessage = { id: uid('msg'), role: 'user', body: content, target };
    setMessages((current) => [...current, optimisticUser]);
    setSending(true);
    setError(null);
    try {
      const cardId = chatTarget === null ? null : state.outline[chatTarget]?.id ?? null;
      const res = await api.postChat(state.deckId, { message: content, cardId });
      setMessages((current) => {
        // 用真实 user/assistant 替换 optimistic
        const filtered = current.filter((m) => m.id !== optimisticUser.id);
        const userMsg: ChatMessage = {
          id: res.userMessage.id,
          role: 'user',
          body: res.userMessage.body,
          target: chatTargetLabel(res.userMessage.cardId, stateRef.current.outline),
        };
        const aiMsg: ChatMessage = {
          id: res.assistantMessage.id,
          role: 'ai',
          body: res.assistantMessage.body,
          target: chatTargetLabel(res.assistantMessage.cardId, stateRef.current.outline),
          actions: res.assistantMessage.actions?.length ? res.assistantMessage.actions.map((a) => ({ ...a })) : undefined,
        };
        return [...filtered, userMsg, aiMsg];
      });
    } catch (err) {
      console.error('[postChat]', err);
      setError(err instanceof ApiError ? humanizeApiError(err) : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const applyAction = async (messageId: string, actionIndex: number) => {
    const targetIndex = chatTarget ?? activeIndex;
    const targetCard = state.outline[targetIndex];
    const message = messages.find((item) => item.id === messageId);
    const action = message?.actions?.[actionIndex];
    if (!action || !targetCard) return;

    const markApplied = () =>
      setMessages((current) =>
        current.map((m) =>
          m.id === messageId
            ? {
                ...m,
                actions: m.actions?.map((item, index) => (index === actionIndex ? { ...item, applied: true } : item)),
              }
            : m,
        ),
      );

    // patch 是 LLM 在 chat 阶段给出的具体改写，apply 时直接落库。
    // 缺 patch（不应该发生，除非 schema 兼容旧消息）时给一个最小的本地兜底。
    const patch = action.patch ?? {
      title: action.kind === 'title' || action.kind === 'tone' ? compactTitle(targetCard.title) : undefined,
      bullets: action.kind === 'bullet' ? [...targetCard.bullets, '补充一个具体判断或数据点'] : undefined,
    };

    if (!state.deckId || !targetCard.version) {
      console.warn('[applyAction] missing deckId or card.version, using local-only edit');
      const localPatch: Partial<CardItem> = {};
      if (patch.title !== undefined) localPatch.title = patch.title;
      if (patch.bullets !== undefined) localPatch.bullets = patch.bullets;
      updateCardAt(targetIndex, localPatch);
      markApplied();
      return;
    }

    try {
      const updated = await api.applyChat(state.deckId, {
        cardId: targetCard.id,
        action: action.kind,
        version: targetCard.version,
        patch,
      });
      const outline = state.outline.map((c) => (c.id === targetCard.id ? cardToFrontend(updated) : c));
      set({ outline });
      markApplied();
    } catch (err) {
      console.error('[applyChat]', err);
      setError(err instanceof ApiError ? humanizeApiError(err) : '应用失败');
    }
  };

  const downloadDeck = async () => {
    if (!state.deckId) {
      console.warn('[downloadDeck] no deckId, exporting local state without backend manifest');
      const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
      triggerDownload(payload, 'vcard-deck.json');
      return;
    }
    try {
      const manifest = await api.exportDeck(state.deckId);
      triggerDownload(JSON.stringify(manifest, null, 2), `vcard-deck-${state.deckId.slice(0, 8)}.json`);
    } catch (err) {
      console.error('[exportDeck]', err);
      setError(err instanceof ApiError ? humanizeApiError(err) : '导出失败');
    }
  };

  const shareDeck = async () => {
    const summary = `${state.prompt} · ${state.outline.length} 张卡片`;
    const url = state.deckId ? `${window.location.origin}${window.location.pathname}#deck=${state.deckId}` : window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'vCard', text: summary, url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
        console.warn('[shareDeck] navigator.share failed', err);
      }
    }
    try {
      await navigator.clipboard?.writeText(`${summary}\n${url}`);
      setMessages((current) => [
        ...current,
        { id: uid('msg'), role: 'ai', body: '已把卡组摘要 + 链接复制到剪贴板。' },
      ]);
    } catch (err) {
      console.error('[shareDeck] clipboard failed', err);
      setError('分享失败，请稍后再试。');
    }
  };

  const quickPrompts = ['让标题更口语', '加 emoji', '换一个角度', '更短一些', '加数据支撑'];

  return (
    <section className="page studio-page">
      <aside className="thumb-rail" aria-label="卡片缩略图">
        <div className="thumb-rail-head">
          <span>共 {state.outline.length} 张</span>
          <span>{String(activeIndex + 1).padStart(2, '0')} / {String(state.outline.length).padStart(2, '0')}</span>
        </div>
        <div className="thumb-list">
          {state.outline.map((card, index) => (
            <button className="thumb" data-active={activeIndex === index} type="button" key={card.id} onClick={() => setActiveIndex(index)}>
              <span className="thumb-num">{String(index + 1).padStart(2, '0')}</span>
              <span className="thumb-card">
                <CardFrame card={card} theme={theme} mode={state.mode} size={state.size} density={state.density} total={state.outline.length} index={index} templateSpec={spec} mini />
              </span>
            </button>
          ))}
        </div>
        <button className="add-card-btn rail-add" type="button" onClick={addCard}>
          <Icon name="plus" size={14} />
          新卡片
        </button>
      </aside>

      <section className="canvas">
        <div className="canvas-toolbar">
          <span className="canvas-title">
            <b>#{String(activeIndex + 1).padStart(2, '0')}</b>
            {activeCard.title}
          </span>
          <div className="toolbar-spacer" />
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDirectEdit((value) => !value)}>
            <Icon name="edit" size={13} />
            直接编辑
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
            <Icon name="palette" size={13} />
            换主题
          </button>
          <span className="toolbar-rule" />
          <button className="btn btn-outline btn-sm" type="button" onClick={downloadDeck}>
            <Icon name="download" size={13} />
            下载
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={shareDeck}>
            <Icon name="share" size={13} />
            分享
          </button>
        </div>

        <div className="canvas-stage" data-chat-focus={chatTarget === activeIndex}>
          <div className="card-stage">
            <CardFrame card={activeCard} theme={theme} mode={state.mode} size={state.size} density={state.density} total={state.outline.length} index={activeIndex} templateSpec={spec} />
            <div className="card-selection-ring">
              <span>CHAT FOCUS · #{String(activeIndex + 1).padStart(2, '0')}</span>
            </div>
          </div>
          {directEdit && (
            <DirectEditPanel card={activeCard} onClose={() => setDirectEdit(false)} onUpdate={(patch) => updateCardAt(activeIndex, patch)} />
          )}
        </div>
      </section>

      <aside className="chat-panel" aria-label="卡片对话编辑">
        <div className="chat-head">
          <span className="assistant-avatar">v</span>
          <span>
            <strong>vCard 助手</strong>
            <small>选中卡片对话编辑</small>
          </span>
          <button className="target-chip" type="button" onClick={() => setChatTarget(chatTarget === null ? activeIndex : null)}>
            {chatTarget === null ? <Icon name="layers" size={12} /> : <Icon name="pin" size={12} />}
            {chatTarget === null ? '全套' : `#${String(chatTarget + 1).padStart(2, '0')}`}
          </button>
        </div>

        {error && (
          <div className="prompt-error" role="alert">
            <Icon name="x" size={13} />
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setError(null)}>
              关闭
            </button>
          </div>
        )}

        <div className="chat-body" ref={chatRef}>
          {messages.map((message) => (
            <article className={`chat-msg ${message.role}`} key={message.id}>
              <span className="msg-avatar">{message.role === 'user' ? '你' : 'v'}</span>
              <div className="msg-body">
                {message.target && (
                  <span className="msg-target">
                    <Icon name="pin" size={10} />
                    {message.target}
                  </span>
                )}
                <p>{message.body}</p>
                {message.actions && (
                  <div className="msg-actions">
                    {message.actions.map((action, actionIndex) => (
                      <button
                        className="msg-action-btn"
                        data-applied={action.applied}
                        disabled={action.applied}
                        type="button"
                        key={action.label}
                        onClick={() => applyAction(message.id, actionIndex)}
                      >
                        {action.applied ? <Icon name="check" size={11} /> : <Icon name="sparkle" size={11} />}
                        {action.applied ? '已应用' : action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="chat-input-wrap">
          <div className="chat-quick">
            {quickPrompts.map((prompt) => (
              <button className="quick-chip" type="button" key={prompt} onClick={() => sendMessage(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <div className="chat-input">
            <textarea
              rows={1}
              value={draft}
              placeholder={`对${chatTarget === null ? '整套卡片' : ` #${String(chatTarget + 1).padStart(2, '0')} `}说点什么...`}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(draft);
                }
              }}
            />
            <button className="send-btn" type="button" disabled={!draft.trim() || sending} onClick={() => sendMessage(draft)} aria-label="发送">
              <Icon name="send" size={15} />
            </button>
          </div>
          <div className="chat-footnote">
            <span>Enter 发送 · Shift+Enter 换行</span>
            <button type="button" onClick={() => setChatTarget(chatTarget === null ? activeIndex : null)}>
              {chatTarget === null ? '改为当前卡片' : '改为整套对话'}
            </button>
          </div>
        </div>
      </aside>
    </section>
  );
}

function DirectEditPanel({ card, onClose, onUpdate }: { card: CardItem; onClose: () => void; onUpdate: (patch: Partial<CardItem>) => void }) {
  const updateBullet = (index: number, value: string) => {
    onUpdate({ bullets: card.bullets.map((bullet, itemIndex) => (itemIndex === index ? value : bullet)) });
  };

  return (
    <aside className="direct-panel" aria-label="直接编辑当前卡片">
      <div className="direct-head">
        <strong>直接编辑</strong>
        <button className="icon-btn" type="button" onClick={onClose} aria-label="关闭直接编辑">
          <Icon name="x" size={15} />
        </button>
      </div>
      <label>
        标题
        <input value={card.title} onChange={(event) => onUpdate({ title: event.target.value })} />
      </label>
      <div className="direct-bullets">
        <span>要点</span>
        {card.bullets.map((bullet, index) => (
          <input key={`${card.id}_${index}`} value={bullet} onChange={(event) => updateBullet(index, event.target.value)} />
        ))}
      </div>
      <button className="text-btn" type="button" onClick={() => onUpdate({ bullets: [...card.bullets, ''] })}>
        <Icon name="plus" size={13} />
        添加要点
      </button>
    </aside>
  );
}

function CardFrame({
  card,
  theme,
  mode,
  size,
  density,
  total,
  index,
  templateSpec,
  mini = false,
}: {
  card: CardItem;
  theme: Theme;
  mode: Mode;
  size: SizeId;
  density: DensityId;
  total: number;
  index: number;
  templateSpec?: TemplateSpec;
  mini?: boolean;
}) {
  const spec = templateSpec ?? resolveTemplate(undefined);
  return (
    <div className={`vc-card ratio-${size}`} data-mini={mini}>
      {mode === 'image' ? (
        <ImageCard card={card} theme={theme} total={total} index={index} templateSpec={spec} />
      ) : (
        <HtmlCard card={card} theme={theme} density={density} total={total} index={index} templateSpec={spec} />
      )}
    </div>
  );
}

function HtmlCard({
  card,
  theme,
  density,
  total,
  index,
  templateSpec,
}: {
  card: CardItem;
  theme: Theme;
  density: DensityId;
  total: number;
  index: number;
  templateSpec: TemplateSpec;
}) {
  const isCover = card.layout === 'cover' || index === 0;
  const isCloser = card.layout === 'closer' || index === total - 1;
  const visibleBullets = templateSpec.bulletVisible[density];
  const closerAsList = templateSpec.closerStyle === 'list';
  // stat 容错：bullets[0] 没数字时用 "—" 占位，并把首条 bullet 让给 statLabel
  const statMatch = card.bullets[0]?.match(/\d+(?:\.\d+)?%?/)?.[0];
  const statValue = statMatch ?? '—';
  const statLabel = statMatch ? card.bullets[0] : (card.bullets[1] ?? card.bullets[0] ?? '');

  return (
    <article className={`html-card density-${density}`} style={{ background: theme.bg, color: theme.fg }}>
      <div className="card-eyebrow" style={{ color: theme.accent }}>
        <span />
        {eyebrowFor(card, isCover, isCloser, templateSpec)}
      </div>

      {isCover ? (
        <div className="cover-content">
          <h2>{card.title}</h2>
          <p>{card.bullets[0] ?? '把一个主题拆成可发布的多张社媒卡片。'}</p>
        </div>
      ) : isCloser ? (
        closerAsList ? (
          <div>
            <h2 className="list-title" style={{ borderColor: theme.accent }}>{card.title}</h2>
            <ul className="card-bullets">
              {card.bullets.slice(0, visibleBullets).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="quote-content">
            <blockquote style={{ borderColor: theme.accent }}>{card.title}</blockquote>
            <ul>
              {card.bullets.slice(0, 2).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        )
      ) : card.layout === 'stat' ? (
        <div className="stat-content">
          <strong style={{ color: theme.accent }}>{statValue}</strong>
          <span>{card.title}</span>
          <p>{statLabel}</p>
        </div>
      ) : card.layout === 'quote' ? (
        <div className="quote-content">
          <blockquote style={{ borderColor: theme.accent }}>{card.title}</blockquote>
          <ul>
            {card.bullets.slice(0, Math.max(1, visibleBullets - 1)).map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <h2 className="list-title" style={{ borderColor: theme.accent }}>{card.title}</h2>
          <ul className="card-bullets">
            {card.bullets.slice(0, visibleBullets).map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </>
      )}

      <footer className="card-foot">
        <span>vCard / {new Date().getFullYear()}</span>
        <strong style={{ color: theme.accent }}>
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </strong>
      </footer>
    </article>
  );
}

function ImageCard({
  card,
  theme,
  total,
  index,
  templateSpec,
}: {
  card: CardItem;
  theme: Theme;
  total: number;
  index: number;
  templateSpec: TemplateSpec;
}) {
  const seedPalettes: Record<TemplateSpec['id'], string[]> = {
    minimal: ['#1a1a2e', '#0c1538', '#2d1b4e', '#1f3a5f', '#251f3a'],
    magazine: ['#3a2418', '#5b3a2e', '#2e1f1a', '#4a2f24', '#3a2a24'],
    briefing: ['#0f1a2e', '#1a2138', '#0c1424', '#1d2742', '#161e34'],
    narrative: ['#2a1a3a', '#3a1f4a', '#2a1834', '#421e54', '#341c44'],
  };
  const palette = seedPalettes[templateSpec.id] ?? seedPalettes.minimal;
  const seed = palette[index % palette.length];
  return (
    <article
      className="image-card"
      data-has-image={Boolean(card.imageUrl) || undefined}
      style={
        {
          '--img-accent': theme.accent,
          '--img-seed': seed,
        } as CSSProperties
      }
    >
      {card.imageUrl ? (
        <img className="image-bg" src={card.imageUrl} alt={card.title} />
      ) : (
        <div className="image-grid" />
      )}
      <div className="image-content">
        <span>
          CARD {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <h2>{card.title}</h2>
        <p>{card.bullets[0]}</p>
      </div>
    </article>
  );
}

function HtmlMiniCard() {
  return (
    <span className="viz-html" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}

function ImageMiniCard() {
  return <span className="viz-img" aria-hidden="true" />;
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function StickyFoot({ children }: { children: ReactNode }) {
  return <div className="sticky-foot">{children}</div>;
}

type PageProps = {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  onNext: () => void;
};

function resizeOutline(outline: CardItem[], count: number): CardItem[] {
  if (count <= outline.length) return outline.slice(0, count);
  const extras = Array.from({ length: count - outline.length }, (_, index) => ({
    id: uid('card'),
    title: `新增卡片 ${outline.length + index + 1}`,
    bullets: ['补充一个要点'],
    layout: 'list' as LayoutId,
  }));
  return [...outline, ...extras];
}

function compactTitle(title: string) {
  return title.length > 16 ? title.slice(0, 16) : `${title}，记住这点`;
}

function getTheme(id: string | undefined): Theme {
  return getThemeFromSpec(id);
}

function PillSelect({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="pill-wrap" ref={ref}>
      <button className="pill-select" data-open={open} type="button" onClick={() => setOpen((value) => !value)}>
        <Icon name={icon} size={14} />
        <span>{label}</span>
        <Icon name="chevron" size={13} />
      </button>
      {open && (
        <div className="dropdown" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownHeader({ children }: { children: ReactNode }) {
  return <div className="dropdown-header">{children}</div>;
}

function DropdownItem({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="dropdown-item" data-checked={checked} type="button" onClick={onClick}>
      <Icon name="check" size={14} />
      {children}
    </button>
  );
}

type IconName =
  | 'arrowDown'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUp'
  | 'brain'
  | 'bulb'
  | 'cards'
  | 'chart'
  | 'check'
  | 'chevron'
  | 'code'
  | 'download'
  | 'edit'
  | 'file'
  | 'globe'
  | 'image'
  | 'layers'
  | 'mail'
  | 'palette'
  | 'pin'
  | 'plus'
  | 'portrait'
  | 'rotate'
  | 'send'
  | 'share'
  | 'sparkle'
  | 'sparkles'
  | 'square'
  | 'story'
  | 'trash'
  | 'type'
  | 'user'
  | 'x';

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrowDown: <polyline points="6 9 12 15 18 9" />,
    arrowLeft: (
      <>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </>
    ),
    arrowRight: (
      <>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </>
    ),
    arrowUp: <polyline points="18 15 12 9 6 15" />,
    brain: (
      <>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z" />
      </>
    ),
    bulb: (
      <>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.1 14A6 6 0 1 0 8.9 14a4.5 4.5 0 0 0 1.6 3h3a4.5 4.5 0 0 0 1.6-3z" />
      </>
    ),
    cards: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    chart: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    chevron: <polyline points="6 9 12 15 18 9" />,
    code: (
      <>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <polyline points="21 15 16 10 5 21" />
      </>
    ),
    layers: (
      <>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </>
    ),
    mail: (
      <>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22 6 12 13 2 6" />
      </>
    ),
    palette: (
      <>
        <circle cx="13.5" cy="6.5" r=".5" />
        <circle cx="17.5" cy="10.5" r=".5" />
        <circle cx="8.5" cy="7.5" r=".5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.7 1.7-1.7h2c3.1 0 5.5-2.4 5.5-5.5C21 6.5 16.5 2 12 2z" />
      </>
    ),
    pin: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    portrait: <rect x="6" y="2" width="12" height="20" rx="2" />,
    rotate: (
      <>
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" />
      </>
    ),
    send: (
      <>
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
        <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
      </>
    ),
    sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
    sparkles: (
      <>
        <path d="M7 3l1.4 4.1L12.5 8.5 8.4 9.9 7 14 5.6 9.9 1.5 8.5 5.6 7.1z" />
        <path d="M18 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
      </>
    ),
    square: <rect x="3" y="3" width="18" height="18" rx="2" />,
    story: <rect x="7" y="2" width="10" height="20" rx="2" />,
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    type: (
      <>
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </>
    ),
    user: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
