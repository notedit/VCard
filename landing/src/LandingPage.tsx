import { Icon, type IconName } from './Icon';

export function LandingPage() {
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
