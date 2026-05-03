# Visual System · 卡片 · 社媒 Studio

> 正式产品的设计语言（不是 wireframe 草图）。
> 当 wireframe 进入中保真 / 高保真阶段，所有视觉决定都按本文执行。

源实现：[`src/screens/ScreenStyleGuide.tsx`](../src/screens/ScreenStyleGuide.tsx)

---

## 目录

- [01 设计哲学](#01-设计哲学)
- [02 色彩](#02-色彩)
- [03 字体](#03-字体)
- [04 核心组件](#04-核心组件)
- [05 间距 / 圆角 / 投影](#05-间距--圆角--投影)
- [06 Voice · Agent 怎么说话](#06-voice--agent-怎么说话)
- [07 Motion · 动效原则](#07-motion--动效原则)
- [设计 Token 速查表](#设计-token-速查表)

---

## 01 设计哲学

三个关键词决定一切。每个组件、每条文案、每段动效，都要能被其中至少一个解释。

| 关键词 | 含义 | 反例 |
|---|---|---|
| **编辑部 (Editorial)** | 信息密度高、版式有节奏。像翻一本好杂志，而不是逛工具栏。 | 大量空白堆砌、所有元素居中、"现代感"就等于稀释信息。 |
| **暖中性 (Warm Neutral)** | 底色是带温度的米白（`#FAFAF7`），不是冷蓝白。让创作不焦虑。 | 纯白背景 + 冷灰阴影 + 蓝色高光 = SaaS 套娃感。 |
| **指令优先 (Verb-first)** | UI 让位给"命令"。⌘K 比侧栏更重要。Agent 是动词，不是助手图标。 | 把所有功能塞进左侧菜单 / 顶部 Tab。 |

**判断标准**：当一个新功能上线时，先问"这件事用 ⌘K 一句话能不能干完？"——如果可以，UI 就不应该单独给它加按钮。

---

## 02 色彩

> 一个中性底 + 双平台主色 + AI 紫蓝。**同一屏最多出现两种品牌色。**

### 中性色（Neutral · 暖中性）

| Token | Hex | 用途 |
|---|---|---|
| `--ink` | `#0F0F12` | 正文 / 标题 |
| `--ink-2` | `#3A3A42` | 次要文字 |
| `--ink-3` | `#7A7A85` | 辅助 / 占位 |
| `--line` | `#E6E4DC` | 分割线 |
| `--surface` | `#FFFFFF` | 卡片底 |
| `--bg` | `#FAFAF7` | 页底（带温度的米白） |

### 品牌色（Accent · 平台主色 + AI）

| Token | Hex | 用途 |
|---|---|---|
| `--redbook` | `#FF4D6D` | 小红书场景主色 |
| `--greenbook` | `#1FB967` | 小绿书场景主色 |
| `--ai` | `#5B6CFF` | Agent / Skills 触发的元素（**仅此用途**） |
| `--hi` | `#FFE680` | 高亮 / 已选 / 用户改动标记 |
| `--warn` | `#FF8A3D` | 警告 / 钩子角色 |
| `--ok` | `#1FB967` | 成功状态（与 `greenbook` 同色，按上下文区分） |

### 用法约束

- **平台互斥**：Redbook 和 Greenbook 不能同时出现，按当前项目所属平台二选一。
- **AI 紫不装饰**：紫只用来标识"这是 Agent 在做事"。不要拿来加菜单选中态、按钮高亮、装饰条。
- **禁止整屏渐变背景**。背景始终是 `--bg` 米白。渐变只用在内容卡片里（如 Image Card 的 `radial-gradient`）。
- **同一屏最多 2 种品牌色**。例：小红书项目里出现 `redbook` + `ai` 是 OK 的；再加 `warn` 就要砍掉一个。

### 角色色板（Plan / 编辑器场景）

叙事角色不复用平台主色，独立一套：

| 角色 | 描边色 | 含义 |
|---|---|---|
| 封面 | `--redbook` (#FF4D6D) | 第一张图，承担钩子作用 |
| 钩子 | `--warn` (#FF8A3D) | 引发好奇 |
| 立论 | `--ink` (#0F0F12) | 解释观点 |
| 清单 | `--ink` (#0F0F12) | 列举 |
| Payoff | `--ai` (#5B6CFF) | 情感升华 |
| CTA | `--greenbook` (#1FB967) | 引导互动 |

**色随角色，不随主题。** 让爆款结构变成可视化语言。

---

## 03 字体

中文 PingFang，英文 Inter，数字等宽 IBM Plex Mono。

### 字体栈

```css
--font-display: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, sans-serif;
--font-body:    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, sans-serif;
--font-mono:    "IBM Plex Mono", ui-monospace, monospace;
```

### 排印规范

| 用途 | 字号 | 字重 | 行高 | letter-spacing | 备注 |
|---|---|---|---|---|---|
| **DISPLAY · 标题** | 28–44 | Semibold (600) | 1.1 | -2% | 卡片标题 / Hero |
| **BODY · 正文** | 13–15 | Regular (400) | 1.6–1.7 | 0 | 段落 / 描述 |
| **MONO · 数据 / 元信息** | 11–13 | Regular | 1.6 | 0 | 尺寸、ID、时间戳：如 `9 cards · 4:5 · 1242×1553` |
| **UI · 控件** | 13–14 | Medium (500) | 1.4 | 0 | 按钮、Chip、Tab；**不用 Bold（留给标题）** |

### 示例

```
DISPLAY  → 200块吃到扶墙出
BODY     → 胡同里的真不踩雷小馆，从老金涮肉到馅老满，7 家店把 200 块吃出仪式感。
MONO     → 9 cards · 4:5 · 1242×1553
            gen_4f9c · 2026-05-03 16:08
UI       → [开始 Plan]  [挂载 Skill]  [取消]
```

---

## 04 核心组件

只列出**该产品独有 / 特殊处理的**组件。通用组件（Input、Select、Modal）按业界惯例。

### 4.1 Skill Chip

挂载状态 / 优先级。

- **未挂载**：虚线边框 + 浅灰文字 + 透明背景。
- **已挂载**：实线 + 阴影 + 数字徽章（用 AI 紫圆形）。
- 可拖拽改优先级。
- 数字徽章 `1`、`2` ... 表示叠加优先级（数字小 = 优先级高）。

```tsx
<span style={{
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 10px',
  background: '#FFFFFF',
  border: '1px solid #E6E4DC',
  borderRadius: 999,
  fontSize: 12, fontWeight: 600,
  boxShadow: '0 1px 3px rgba(15,15,18,.04)',
}}>
  1 · 爆款标题手
</span>
```

### 4.2 Role Tag

叙事角色标签（封面 / 钩子 / 立论 / 清单 / Payoff / CTA）。

- 边框 + 文字同色（见 [02 色彩 · 角色色板](#角色色板plan--编辑器场景)）。
- 透明背景。
- 字号 11，字重 700，padding `1px 6px`，圆角 4px，letter-spacing 0.5。

### 4.3 ⌘K Command Bar

自由说 + 候选指令。

- 悬浮在编辑器底部，永远可达。
- 圆角 14px，浮层投影 `0 6px 20px rgba(15,15,18,.08)`。
- 左侧 18×18 紫色 K 徽章（`--ai` 背景，圆角 5px）。
- 中间灰色占位文字 `让 Agent 把它改成…`。
- 右侧候选 chip + 提交按钮 `⌘ + ↵`（深色填充）。

支持：自然语言 / 一键候选 / 模板指令（"按 Skill 重写"）。

### 4.4 Agent Suggestion

主动建议卡 · 可采纳 / 忽略。

三种色按建议类型：

| 颜色 | 类型 | 例 |
|---|---|---|
| 黄 (`#FFF8E5` / `#F0D77A`) | **结构** | 第 5 张密度过高，拆成 5a/5b？ |
| 蓝 (`#E5EAFF` / `#3340B3`) | **平台 SOP** | 小红书帖子还没"避雷"段，加一张反向卡？ |
| 紫 (`--ai` 浅) | **技术** | 检测到 #4 在小屏会糊，自动重生 1024px？ |

每个建议 = 问题 + 一键修复方案。底部一对动作 chip：
- 主动作（深色填充）："采纳" / "让我看" / "好"
- 次动作（白底）："忽略" / "不用"

**忽略 N 次后此项不再提示**（默认 N=3）。

### 4.5 Image Card

gpt-image-2 直出 · 文字烧入。

- 4:5 宽高比（小红书）/ 1:1（小绿书）。
- 圆角 8px。
- 背景：`radial-gradient` 模拟摄影画面，文字白色 + `text-shadow: 0 1px 2px rgba(0,0,0,.5)`。
- 左上角 `IBM Plex Mono` 编号徽章（如 `1/9`），白色半透明底。
- 所有卡共享主体锚点 prompt 前缀。
- 单卡支持局部重生 / 蒙版 / 历史版本。
- 重生中：边框 `2.4px solid var(--ai)`，流动渐变（见 [Motion](#07-motion--动效原则)）。

### 4.6 Plan Node

可拖拽 · 可对话改写。

```
┌──────────────────────────────────────────┐
│ ⋮⋮  [3]  清单  edited 2m ago        ✦   │
│         #01 老金涮肉 · 38￥                │
└──────────────────────────────────────────┘
```

- 左侧 `⋮⋮` 拖拽柄（`--ink-3` 灰色）。
- 圆形数字徽章（24×24，`--ai` 紫底白字）。
- 顶部一行：Role Tag + Mono 元信息（`edited 2m ago`）。
- 主标题：14px Semibold。
- 右侧 `✦` 表示"AI 改写"入口。
- 用户编辑过的卡片自动加 `用户改过` 黄色 tag。

---

## 05 间距 / 圆角 / 投影

### Spacing · 4-pt 基准

```
4 · 8 · 12 · 16 · 24 · 32
```

只用 4 的倍数。`6`、`10`、`18`、`20` 都不允许。

### Radius · 两档制

| 圆角 | 用途 |
|---|---|
| **8** | 按钮、输入框、Chip、Tag 等控件 |
| **14** | 卡片、Panel、弹层 |
| **999** | 药丸（Pill、Skill Chip、徽章） |

不允许 6 / 10 / 12 / 16 / 20 这些"中间值"。

### Shadow · 三档

| 名字 | CSS | 用途 |
|---|---|---|
| `none` | `none` | 默认。卡片不带阴影。 |
| `hover` | `0 2px 8px rgba(15,15,18,.06)` | 卡片悬停 |
| `float` | `0 8px 24px rgba(15,15,18,.10)` | ⌘K Command Bar / 弹层 / Modal |

**投影只用于浮层。** 普通卡片靠 `--line` 边框区分层次，不靠阴影。

---

## 06 Voice · Agent 怎么说话

> 所有 AI 输出文案都过这套。Agent 是同事，不是客服 / 拟人萌宠。

### ✅ 做

| 原则 | 例 |
|---|---|
| **像同事** | "我把 #5 拆了，要保留吗？" |
| **显式说明意图** | "这是为了和 #2 呼应" |
| **给可逆操作** | "采纳 / 撤回 / 看我做了什么" |

### ❌ 不做

| 反例 | 例 |
|---|---|
| **拟人过度** | ❌ "亲爱的""主人""好的呢～" |
| **废话开头** | ❌ "好的，我来帮您…" |
| **不可逆默认** | ❌ 静默改完只通知"已完成"。永远先问后改。 |

### 文案模板

| 场景 | 模板 |
|---|---|
| 主动建议 | `[原因] · [建议] · [可逆动作 chip]` |
| 改完确认 | `改好了。同时在 #X 也改了 [...]，要保留吗？  [保留] [撤回]` |
| 失败 | `[失败原因] · [一键重试 chip]`，不要"出错了，请稍后再试"。 |

### 护栏

- **从不静默修改用户内容**。所有 Agent 改动必须有 diff + 撤回。
- 同一会话内最多主动提 5 条建议；忽略后降权。
- 检测平台违规词（医疗 / 金融极限词）→ 弹平台规则提示，不强删。

---

## 07 Motion · 动效原则

> 只为了表达**因果**，不装饰。

### 三条原则

| 场景 | 动效 | 时长 / 缓动 | 表达的因果 |
|---|---|---|---|
| **Plan 节点变化** | 卡片高亮 + 1px 上浮 | 200ms ease-out | "这里被改了" |
| **图像生成中** | 边框流动渐变（AI 紫 → 透明） | 1.5s linear loop | "AI 在工作" |
| **Skill 挂载** | 从底部滑入 + 数字徽章弹跳 | spring damping=0.4 | "新增了一个能力，且优先级是 N" |

### 禁用清单

- ❌ 旋转 spinner（缺乏因果说明）。用边框流动替代。
- ❌ 弹窗淡入 + 模糊 + 缩放叠加。只用淡入。
- ❌ 滚动视差。
- ❌ 默认动画时长 > 300ms。极少数情况除外。

### 缓动

```css
--ease-out:    cubic-bezier(.16, 1, .3, 1);   /* 默认 */
--ease-spring: cubic-bezier(.34, 1.56, .64, 1); /* 弹跳 */
--ease-linear: linear; /* loop 动画 */
```

---

## 设计 Token 速查表

```css
:root {
  /* 中性 */
  --ink:        #0F0F12;
  --ink-2:      #3A3A42;
  --ink-3:      #7A7A85;
  --line:       #E6E4DC;
  --surface:    #FFFFFF;
  --bg:         #FAFAF7;

  /* 品牌 */
  --redbook:    #FF4D6D;
  --greenbook:  #1FB967;
  --ai:         #5B6CFF;
  --hi:         #FFE680;
  --warn:       #FF8A3D;
  --ok:         #1FB967;

  /* 字体 */
  --font-display: "PingFang SC", "Hiragino Sans GB", -apple-system, sans-serif;
  --font-body:    "PingFang SC", "Hiragino Sans GB", -apple-system, sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, monospace;

  /* 圆角 */
  --radius-control: 8px;
  --radius-card:    14px;
  --radius-pill:    999px;

  /* 阴影 */
  --shadow-hover: 0 2px 8px rgba(15, 15, 18, .06);
  --shadow-float: 0 8px 24px rgba(15, 15, 18, .10);

  /* 缓动 */
  --ease-out:    cubic-bezier(.16, 1, .3, 1);
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
}
```

### 间距快查（4-pt 基准）

```
4   tag padding-x、icon gap
8   chip / button gap, list gap
12  card padding, section gap
16  card outer padding
24  section vertical padding
32  page top padding
```

---

## 相关文档

- [完整 PRD（17 章节）](../public/prd.html) — 含里程碑、技术选型、验收标准。
- [Wireframe 实现](../src/screens/) — 所有屏幕的 React 组件源码。
- [Style Guide 屏幕实现](../src/screens/ScreenStyleGuide.tsx) — 本文的可视化版本。
