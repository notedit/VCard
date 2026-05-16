# 落地页改版 Brief：从「工作台」转向「Agent Skills」

> 本文是实现的单一依据。**只改 `apps/web/src/App.tsx` 的 `LandingPage` 组件与相关 CSS**；不删 workspace 代码、不删 `#app` 路由、不动 API。
> 文案直接可粘贴。Voice & Tone 遵循 `apps/api/src/llm/skills/voice-tone.zh.md` 与 CLAUDE.md：具体、动词化、不编数据，禁用「赋能 / 无缝 / 释放 / 下一代 / 智能化 / 重塑 / 革新」等套话。

---

## 0. 范围决定（来自用户拍板，不可改）

1. **只从落地页移除入口**：删掉所有「打开工作台 / 开始创作」CTA 和工作台耦合 section。**app 代码与 `#app` 路由完全保留**（`App.tsx` 里 `startWorkspace` / `showLanding` / `#app` hash 逻辑不动），workspace 仍可通过 `/#app` 直达，只是落地页不再引导。
2. **安装说明面向 Codex / 通用 coding agent**，不以 Claude Code 为主叙述。
3. 没有 marketplace / 插件市场。安装路径就是「`git clone` 仓库 → 把 `skills/` 下的两个目录放进你 agent 的 skills 目录」。命令必须基于本仓库真实结构、能跑通。

---

## 1. 定位

### 一句话

> **vCard 是一组装好就能用的 agent skills，让你的 coding agent 把一个主题、一篇文章、一段笔记，做成一整套高质感社媒卡片。**

### 电梯陈述（3 句，skills 视角）

1. vCard 不是又一个网页工具，是两个可以装进 Codex 或任意 coding agent 的 skill：一个用 HTML/CSS + Playwright 渲染确定性文字卡，一个用 GPT-image-2 生成图片卡。
2. 装好之后，你在自己的 agent 里说一句「用 text-card-generator 把这篇文章做成 9 张卡」，它就按主题 × 设计语言体系排版、渲染、做视觉 QA、逐张重跑弱卡，最后给你导出的 PNG。
3. 卡片在你本地的仓库目录里生成，文案、版式、主题都能让 agent 继续改，不用切到别的产品。

---

## 2. 新信息架构（从上到下）

> id 沿用现有 anchor 习惯；标注每个 section 的处置。**删除的 section 整段移除其 JSX 与对应 CSS 类**。

| 顺序 | section id | role | 旧来源 | 处置 |
|---|---|---|---|---|
| nav | `landing-nav` | 顶栏：品牌 + 锚点导航 | 现有 | **改造**：导航锚点改为「范例 / 能力 / 安装」；右侧「打开工作台」按钮**删除**，换成指向 `#install` 的「安装 skill」文字链接（不指向 workspace） |
| 1 | `landing-hero` | 一句话定位 + skills 叙事 + 主 CTA | 现有 hero | **改造**：双 CTA（`开始创作` / `看看效果`）删除；改为「安装 skill（→ #install）」+「看范例（→ #showcase）」。`landing-stats` 三个指标改写为 skills 事实。视觉拼贴 `landing-visual` 保留（纯装饰，无 `onStart`） |
| 2 | `landing-showcase` | 8 张成品范例 = skills 能产出什么 | 现有 `landing-showcase` | **保留并重述**：图片不变（已在 `apps/web/public/templates/`），eyebrow/标题/说明改为「这些都是 skills 跑出来的」语境 |
| 3 | `landing-skills` | **新增**：两个 skill 各自能力 | 无 | **新增**：替代被删的 `landing-modes`，讲清两个 skill 分别做什么、什么时候用哪个 |
| 4 | `landing-install` | **新增**：安装 + 触发用法（核心 section） | 无（吸收旧 `landing-workflow` 的「分步」骨架） | **新增**：获取 → 放进 agent skills 目录 → 在 agent 里怎么说。含可直接复制的命令块 |
| 5 | `landing-features` | skill 的工程能力点 | 现有 `landing-features` | **保留并重述**：6 个能力点改写为「skill 做了什么」而非「工作台界面有什么」 |
| 6 | `landing-audiences` | 适用人群（skills 语境） | 现有 `landing-audiences` | **保留并重述**：去掉「工作台」「5 分钟出第一稿」等界面/编造表述，改为「在你的 agent 里」 |
| 7 | `landing-faq` | **新增（可选，建议做）**：消除安装疑虑 | 无 | **新增**：3 条 QA，回答「需要哪个 agent」「要不要 API key」「卡片生成在哪」 |
| footer | `landing-footer` | 页脚 | 现有 | **改造**：tagline `Social card production desk` 删除，换成 skills 定位短句；底部 meta 去掉「已适配…工作台」表述，保留平台尺寸事实 |

### 删除的 section（整段移除）

- **`landing-modes`（id=`modes`）**：整段删。这是「打开工作台才有意义」的工作台耦合 section（内嵌 `<CardFrame .../>` 实时预览），由新 `landing-skills` 替代。
- **`landing-workflow`（id=`workflow`）**：整段删。其第 5 步「工作台」直接耦合 workspace，且整体在讲「网页里的 5 步」。其「分步骤」的信息骨架在新 `landing-install` 里以「安装 3 步」复用，但内容完全重写。
- **`landing-cta`（末尾「打开工作台」CTA section）**：整段删。最后一个 `onStart` 调用在这里。

### 新增的 section

- **`landing-skills`（id=`skills`）**：两个 skill 的能力卡。
- **`landing-install`（id=`install`）**：安装 + 触发，含命令块。**这是改版后最重要的 section。**
- **`landing-faq`（id=`faq`，可选但建议）**：3 条常见问题。

---

## 3. 逐 section 最终文案（中文，可直接粘贴）

> 约束复述：标题 ≤ 18 字；不用冒号副标题双段结构；不带序号前缀；不编数据；动词驱动；禁用套话词。

### 3.1 nav `landing-nav`

- 品牌不变（`vCard` lockup 不动）。
- 导航锚点（替换现有 4 个）：
  - `范例` → `#showcase`
  - `两个 skill` → `#skills`
  - `安装` → `#install`
  - `能力` → `#features`
- 右侧操作区（替换原「打开工作台」按钮）：
  - 文案：`安装 skill`
  - 指向：`#install`（不再 `onClick={onStart}`）

### 3.2 hero `landing-hero`

- eyebrow（`landing-kicker`）：`装进你 coding agent 的卡片 skill`
- h1（沿用 `<span>` + `<em>` 两段排版）：
  - 第一段：`一篇文章`
  - 第二段（`<em>`，保留箭头 `<b>→</b>`）：`一套社媒卡片`
- 说明段（替换原 `AI 拆大纲 · 批量生成 · 对话微调，直接发。`）：
  > `两个 agent skill：一个用 HTML/CSS + Playwright 渲染文字卡，一个用 GPT-image-2 生成图片卡。装进 Codex 或你常用的 coding agent，让它把素材排成可发布的卡组。`
- 平台行 `landing-platforms`：**保留**（小红书 / 微信·小绿书 / 即刻 / 公众号 / X·Twitter 是真实对齐的尺寸事实，作为「卡片往哪发」的说明，不涉及工作台）。
- 操作区 `landing-actions`（替换两个按钮）：
  - 主按钮：`安装 skill` → `<a className="btn btn-accent" href="#install">`（去掉 `onClick`）
  - 次按钮：`看范例` → `<a className="btn btn-outline" href="#showcase">`
- `landing-stats` 三项（替换现有「5 步 / 2 种 / 1 张」，全部改为 skills 事实，不编数据）：
  - `2 个` / `安装即用的 skill`
  - `HTML` / `Playwright 渲染，文案精确可控`
  - `多比例` / `1:1 · 3:4 · 9:16 及自定义`

### 3.3 showcase `landing-showcase`（保留，重述文案）

- eyebrow：`成品范例`
- h2：`这些都是 skill 跑出来的`
- 说明：
  > `每个主题预设搭一套设计语言：工程纸、观点海报、事故发布、牛皮档案、组件标本、叙事开场、单数字海报、收藏向笔记。同一份内容，换主题不换骨架。`
- 8 张图与 `label` / `meta` **不改**（数据真实，对应 skill 的 theme × design-language 体系）。

### 3.4 skills `landing-skills`（新增）

- eyebrow：`两个 skill`
- h2：`确定性文字卡，或图片卡`
- 说明：
  > `两个 skill 用同一套主题与设计语言体系，按内容选其一，或在一组卡里混用。`
- 两张能力卡（替换原 `landing-mode-card`，去掉内嵌 `<CardFrame>` 实时预览，改为纯文案卡）：

  **卡一 · text-card-generator**
  - 标签：`文字卡`
  - 标题：`HTML 渲染的精确文字卡`
  - 一句话能力：`把内容写成确定性 HTML/CSS 卡，用 Playwright 截图导出。`
  - 要点列表：
    - `文案精确、可改、不会被模型重写`
    - `主题预设 × 设计语言体系，避免一眼 AI 的版式`
    - `1:1 / 3:4 / 9:16 及自定义比例，逐张视觉 QA 后重跑弱卡`

  **卡二 · image-card-generator**
  - 标签：`图片卡`
  - 标题：`GPT-image-2 生成的图片卡`
  - 一句话能力：`用 GPT-image-2 直接生成信息优先的图片卡。`
  - 要点列表：
    - `先定文案与信息层级，再让模型出图`
    - `封面图主导，氛围强、适合热点与叙事`
    - `每张卡保存 prompt，单张失败可单张重跑`

### 3.5 install `landing-install`（新增，核心）

- eyebrow：`安装与使用`
- h2：`三步装进你的 agent`
- 说明：
  > `skills 是普通目录，clone 下来放进你 coding agent 读取的 skills 目录即可。下面以 Codex 为例。`
- 三步（沿用 `landing-steps` 的 `<ol>` 结构与编号样式）：
  - **01 获取** —— `clone 仓库，skills/ 下是两个目录：text-card-generator 与 image-card-generator。`
  - **02 放进 skills 目录** —— `软链接或拷贝到你 agent 的 skills 目录。Codex 读 ~/.codex/skills/，仓库内项目级读 .agents/skills/ 或 .claude/skills/。`
  - **03 在 agent 里触发** —— `直接说要做什么，例如「用 text-card-generator 把这篇文章做成 9 张 3:4 的卡」。`
- 命令块（可直接展示与复制；基于本仓库真实结构，`skills/` 已被 git 跟踪）：

```bash
# 1. 获取 skills（任意目录）
git clone https://github.com/<your-org>/vcard.git
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
#   "用 image-card-generator 给这个主题做 5 张 4:5 的图片卡"
```

> 实现注记：`<your-org>/vcard` 占位符在落地实现时替换为真实仓库地址；若暂无公开地址，文案改为「clone 本仓库」并去掉具体 URL，不要写一个不存在的地址。`.claude/skills -> ../skills` 在本仓库内已是符号链接（已被 git 跟踪），这是「项目级 skills 目录」约定的真实例证，可在 FAQ 里点明。

- 两个 skill 各一句话能力说明（紧贴命令块下方）：
  - `text-card-generator —— 用 HTML/CSS + Playwright 渲染确定性文字卡，文案精确、多比例、逐张 QA。`
  - `image-card-generator —— 用 GPT-image-2 生成信息优先的图片卡，封面主导、单张可重跑。`

### 3.6 features `landing-features`（保留，重述为 skill 能力）

- eyebrow：`skill 做了什么`
- h2：`不是模板商城，是会排版的 skill`
- 说明：
  > `skill 自带主题、设计语言、版式与视觉 QA 规则。不靠你挑模板，靠它按内容判断。`
- 6 个能力点（替换现有 `features` 数组的 `title` / `body`，icon 沿用）：
  - `大纲先行`：`先把内容拆成一张一卡的论点，再排版面。每张卡只承担一个观点。`
  - `两个 skill`：`确定性文字卡或 GPT-image-2 图片卡，按内容选，或一组里混用。`
  - `主题 × 设计语言`：`工程纸、观点海报、档案、标本等预设，各配一套设计语言，避开一眼 AI 的版式。`
  - `视觉 QA`：`渲染后逐张打分，边界、层级、信息量不达标就重跑，每张最多三轮。`
  - `多比例导出`：`1:1 / 3:4 / 9:16 及自定义，Playwright 默认 2x 截图导出 PNG。`
  - `对齐平台尺寸`：`小红书、微信小绿书、即刻、公众号、X 的常用尺寸都已对齐。`

### 3.7 audiences `landing-audiences`（保留，重述）

- eyebrow：`适用人群`
- h2：`给把内容当生产资料的人`（保留，无套话、无编造）
- 三项（替换 `audiences` 数组 `body`，去掉「工作台」「5 分钟出第一稿」等界面/编造表述）：
  - `内容创作者` / `把一篇稿件拆成一套可发的卡片` / `在你的 agent 里，把原始素材交给 text-card-generator，它拆论点、排版、渲染、QA。`
  - `知识工作者` / `把研究、报告、长文沉淀成社媒资产` / `用大纲控制论点，用主题控制气质，让非专业读者也读得完。`
  - `运营 / 教育` / `稳定批量产出选题与连载` / `同一份大纲反复换主题、调密度、改版式，把每周产出做成可重复的流程。`

### 3.8 faq `landing-faq`（新增，建议做）

- eyebrow：`常见问题`
- h2：`装之前先看这三条`
- 三条 QA：
  - **需要哪个 agent？** —— `任意能读取本地 skills 目录、能跑 shell 的 coding agent。Codex 读 ~/.codex/skills/，Claude Code 读 .claude/skills/，很多通用 agent 读项目内 .agents/skills/。`
  - **需要 API key 吗？** —— `text-card-generator 不需要，纯本地 HTML/CSS + Playwright。image-card-generator 需要 GPT-image-2 的访问凭证（按 skill 文档配置）。`
  - **卡片生成在哪？** —— `在你本地仓库目录里（如 cards/<主题>/ 或 image-cards/<主题>/），文案、版式、主题都能让 agent 继续改。`

### 3.9 footer `landing-footer`

- 删除 tagline：`Social card production desk`（`landing-footer-tag` 那一行）。
- 替换为：`装进 coding agent 的社媒卡片 skill`
- 底部 meta 调整：
  - 删除/改写 `已适配 小红书 / 微信小绿书 / 即刻 / 公众号`（原文暗示「工作台已适配」），改为中性事实：`卡片尺寸已对齐 小红书 / 微信小绿书 / 即刻 / 公众号`
  - `© {year} vCard` 保留。

---

## 4. 安装 / 使用 section 完整内容（汇总，供单独排版参考）

见 3.5。要点复述：

- **结构**：eyebrow `安装与使用` + h2 `三步装进你的 agent` + 说明 + `<ol>` 三步 + 命令块 + 两行 skill 能力说明。
- **三步**：获取（git clone，skills/ 下两个目录）→ 放进 agent skills 目录（Codex `~/.codex/skills/`，项目级 `.agents/skills/` 或 `.claude/skills/`，软链接或拷贝）→ 在 agent 里自然语言触发。
- **命令块**：见 3.5 代码块，已基于本仓库真实结构（`skills/text-card-generator`、`skills/image-card-generator` 真实存在且被 git 跟踪），软链接与拷贝两种方式都给。**不发明 marketplace。**
- **两个 skill 一句话能力**：见 3.5 末尾两行。
- **触发示例**（写进命令块注释，已含）：`"用 text-card-generator 把 ./article.md 做成 9 张 3:4 的卡"`。

---

## 5. 实现注意（React / CSS / typecheck）

### 5.1 必删的 JSX 与 CSS 类

| 删除对象 | 位置（`App.tsx` `LandingPage`，约行号） | 说明 |
|---|---|---|
| 顶栏「打开工作台」按钮 | ~373，`<button className="btn btn-primary btn-sm" onClick={onStart}>` | 整个 `landing-nav-actions` 内的按钮换成 `<a href="#install">安装 skill</a>` |
| hero 双 CTA | ~401（`onClick={onStart}` 的 `开始创作`）、~405（`看看效果`） | `landing-actions` 内两个元素替换为 `<a href="#install">` 与 `<a href="#showcase">`，去掉 `onClick` |
| 整个 `landing-modes` section | ~458–505 | 含 `landing-modes-grid`、`landing-mode-card`、`landing-mode-html`、`landing-mode-image`、`landing-mode-head`、`landing-mode-tag`、`landing-mode-time`、`landing-mode-points`、`landing-mode-preview` 全部删；内嵌 `<CardFrame .../>` 两处一并删 |
| 整个 `landing-workflow` section | ~507–531 | `landing-steps` 结构样式可在新 `landing-install` 复用，但本 section 整段删 |
| 整个 `landing-cta` section | ~597–612 | 含 `landing-cta-inner`、最后一个 `onClick={onStart}`、`btn-outline invert` 删 |
| footer tagline | ~621，`<span className="landing-footer-tag">Social card production desk</span>` | 改文案（见 3.9）；类名可保留 |

- **`onStart` 调用点共 4 处**：~373 / ~401 / ~603 三处随对应元素删除；nav 与 hero 两处改为 `<a href>`。删完后 `LandingPage` 内不再有任何 `onStart()` 调用。
- **CSS 清理**：上表点名的 `landing-modes*`、`landing-mode-*`、`landing-cta*`、`btn-outline invert`（如别处未用）相关规则在对应样式文件里一并删，避免死样式。`landing-steps` 系列样式**保留**（新 install section 复用）。新 section 若需新类（`landing-skills`、`landing-skills-grid`、`landing-skill-card`、`landing-install`、`landing-install-code`、`landing-faq`、`landing-faq-item`），按 `.impeccable.md` 风格新增：黑白灰 + 单一强调色，不加渐变/霓虹，命令块用等宽字体、深色面板。

### 5.2 `onStart` prop 的最稳处理（不破坏 typecheck）

约 258 行：`return <LandingPage onStart={startWorkspace} />;`，约 327 行：`function LandingPage({ onStart }: { onStart: () => void })`。

**推荐做法（改动最小、零 typecheck 风险、保留回退能力）**：

- 把 prop 改为可选并标记未使用，签名改为：
  `function LandingPage({ onStart: _onStart }: { onStart?: () => void })`
- 函数体内不再使用 `_onStart`（下划线前缀避开 `noUnusedParameters`/lint 的「未使用」告警；TS 对解构出的下划线变量默认不报）。
- `App.tsx` ~258 行的 `<LandingPage onStart={startWorkspace} />` **保持不变**：prop 变可选后，继续传 `startWorkspace` 合法且不报错，`startWorkspace` / `showLanding` / `#app` 逻辑全部保留，`/#app` 仍可直达 workspace。

> 这样既不破坏 typecheck，也不删 workspace 入口逻辑，未来若要恢复落地页入口，改回一个 `<a>` 为 `<button onClick={onStart}>` 即可。**不要直接删 `onStart` prop**——会让 ~258 行传参报「多余 prop」TS 错误，违反「app 代码保留」的范围约束。

### 5.3 showcase 图片

- 8 张图已在 `apps/web/public/templates/`（`t1-technical.png` … `t8-social.png`，`t6` 为 `.jpg`），实测存在。**沿用现有 `src` 与 `width/height/loading/decoding` 属性，不改图、不改路径。** 只改 section 的 eyebrow / h2 / 说明文案（见 3.3）。

### 5.4 不要做的事

- 不删 `App.tsx` 中 `startWorkspace`、`goHome`、`showLanding`、`hashchange` 监听、`#app` 路由相关逻辑。
- 不动 `apps/api/`、不动 `docs/tech-design.md` 的实现真相（本次纯文案/落地页结构改动，不触发 tech-design 同步条件）。
- 不发明 marketplace / 插件市场 / 一键安装脚本；安装路径只用真实的 `git clone` + 软链接/拷贝。
- 文案里不出现编造数字（如「5 分钟」「7-10 张」这类原文里的虚构指标，重写时去掉）。

---

## 6. 三个落地清单

### 删除清单

1. nav：`landing-nav-actions` 内「打开工作台」`<button onClick={onStart}>`（~373）。
2. hero：`landing-actions` 内「开始创作」`<button onClick={onStart}>`（~401）与「看看效果」`<a>`（~405）——替换为 `<a href="#install">` / `<a href="#showcase">`。
3. 整个 `landing-modes` section（id=`modes`，~458–505），含全部 `landing-mode*` / `landing-modes-grid` 类与两处内嵌 `<CardFrame>`。
4. 整个 `landing-workflow` section（id=`workflow`，~507–531）。
5. 整个 `landing-cta` section（~597–612），含最后一个 `onClick={onStart}`、`landing-cta-inner`、`btn-outline invert`。
6. footer tagline 文案 `Social card production desk`（~621）。
7. 上述被删类的死 CSS 规则（`landing-modes*`、`landing-mode-*`、`landing-cta*`，及未复用的 `btn-outline invert`）。
8. 落地页内全部 `onStart()` 调用（删完后归零）；`onStart` prop 改可选不删（见 5.2）。

### 新增清单

1. nav 锚点改 4 项：`范例 #showcase` / `两个 skill #skills` / `安装 #install` / `能力 #features`；右侧新增 `安装 skill` `<a href="#install">`。
2. 新 section `landing-skills`（id=`skills`）：eyebrow + h2 + 说明 + 两张 skill 能力卡（纯文案，无 `CardFrame`）。
3. 新 section `landing-install`（id=`install`）：eyebrow + h2 + 说明 + `<ol>` 三步 + 命令代码块 + 两行 skill 能力说明。
4. 新 section `landing-faq`（id=`faq`，建议做）：3 条 QA。
5. hero `landing-stats` 三项改为 skills 事实（2 个 / HTML / 多比例）。
6. footer tagline 改为 `装进 coding agent 的社媒卡片 skill`；meta 改中性表述。
7. 新 section 所需 CSS 类（`landing-skills*` / `landing-install*` / `landing-faq*`），按 `.impeccable.md` 极简专业风格。

### 文案清单（按 section，均可直接粘贴）

- **定位**：见 §1（一句话 + 3 句电梯陈述）。
- **nav**：锚点 4 项 + `安装 skill` 链接（§3.1）。
- **hero**：eyebrow `装进你 coding agent 的卡片 skill`；h1 `一篇文章` / `一套社媒卡片`；说明段；CTA `安装 skill` / `看范例`；stats 三项（§3.2）。
- **showcase**：eyebrow `成品范例`；h2 `这些都是 skill 跑出来的`；说明（§3.3）。
- **skills**：eyebrow `两个 skill`；h2 `确定性文字卡，或图片卡`；两张卡完整文案（§3.4）。
- **install**：eyebrow `安装与使用`；h2 `三步装进你的 agent`；三步文案 + 命令块 + 两行能力说明（§3.5）。
- **features**：eyebrow `skill 做了什么`；h2 `不是模板商城，是会排版的 skill`；6 个能力点（§3.6）。
- **audiences**：eyebrow `适用人群`；h2 `给把内容当生产资料的人`；三项重写（§3.7）。
- **faq**：eyebrow `常见问题`；h2 `装之前先看这三条`；3 条 QA（§3.8）。
- **footer**：tagline + meta（§3.9）。
