import type { CardLayout, Density } from './index.js';

// ============================================================
// Themes — 6 个视觉主题
// ============================================================

export type ThemeId = 'mono' | 'paper' | 'graphite' | 'indigo' | 'sage' | 'noir';

export interface ThemePalette {
  id: ThemeId;
  name: string;
  meta: string;
  bg: string;
  fg: string;
  accent: string;
}

export const THEMES: readonly ThemePalette[] = [
  { id: 'mono', name: 'Mono', meta: 'Editorial', bg: '#fdfdfb', fg: '#0b0b0d', accent: '#0b0b0d' },
  { id: 'paper', name: 'Paper', meta: 'Magazine', bg: '#f4efe6', fg: '#1c1713', accent: '#9c2a1f' },
  { id: 'graphite', name: 'Graphite', meta: 'Dark info', bg: '#1b1b1f', fg: '#f4f4f2', accent: '#f4f4f2' },
  { id: 'indigo', name: 'Indigo', meta: 'AI native', bg: '#101033', fg: '#f8f8ff', accent: '#6262ff' },
  { id: 'sage', name: 'Sage', meta: 'Knowledge', bg: '#e9efe5', fg: '#1f2a1b', accent: '#406c2d' },
  { id: 'noir', name: 'Noir', meta: 'High contrast', bg: '#070708', fg: '#fff2a8', accent: '#fff2a8' },
];

export function getTheme(id: string | undefined): ThemePalette {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

// ============================================================
// Image Styles — 6 种图像风格
// ============================================================

export type ImageStyleId =
  | 'editorial'
  | 'documentary'
  | 'minimal'
  | 'product'
  | 'illustration'
  | 'abstract';

export interface ImageStyleSpec {
  id: ImageStyleId;
  name: string;
  color: string;
  promptHint: string;
}

export const IMAGE_STYLES: readonly ImageStyleSpec[] = [
  { id: 'editorial', name: '编辑摄影', color: '#3d3dff', promptHint: 'editorial photography, cinematic lighting, restrained palette' },
  { id: 'documentary', name: '纪实感', color: '#18212f', promptHint: 'documentary photography, candid moment, natural light' },
  { id: 'minimal', name: '极简物件', color: '#e4e4e8', promptHint: 'minimalist still life, single subject, soft shadow' },
  { id: 'product', name: '产品渲染', color: '#ff6b55', promptHint: 'product render, studio lighting, sharp detail' },
  { id: 'illustration', name: '克制插画', color: '#caa15a', promptHint: 'editorial illustration, limited color, hand-drawn texture' },
  { id: 'abstract', name: '抽象结构', color: '#6b7280', promptHint: 'abstract geometric composition, monochrome' },
];

export function getImageStyle(id: string | undefined): ImageStyleSpec {
  return IMAGE_STYLES.find((s) => s.id === id) ?? IMAGE_STYLES[0];
}

// ============================================================
// Template Spec — 4 种卡组模板
// ============================================================

export type TemplateId = 'minimal' | 'magazine' | 'briefing' | 'narrative';

export interface TemplateSpec {
  id: TemplateId;
  /** 中文展示名（也是历史上 settings.template 字段存的值，向前兼容） */
  name: string;
  /** 一行副标 */
  meta: string;
  /** 一句话风格偏置，拼进 LLM system prompt */
  voiceBias: string;
  /** 每条 bullet 最多字数，作为 LLM 提示（不强校验） */
  bulletMaxLength: number;
  /** 各 density 下前端显示的 bullet 数 */
  bulletVisible: Record<Density, number>;
  /** 推荐主题（picker 加视觉强调） */
  recommendedThemes: ThemeId[];
  /** 中间版式分布权重，0-1，三项之和约为 1。cover/closer 由 structural-rules 强制 */
  layoutDistribution: Partial<Record<CardLayout, number>>;
  /** 推荐的图像风格 */
  imageStyleBias: ImageStyleId[];
  /** 卡片顶部 eyebrow 文案 */
  eyebrowText: string;
  /** closer 卡的渲染倾向 */
  closerStyle: 'quote' | 'list';
  /** 选这个 template 时的默认主题与图像风格 */
  defaultTheme: ThemeId;
  defaultImageStyle: ImageStyleId;
}

export const TEMPLATES: readonly TemplateSpec[] = [
  {
    id: 'minimal',
    name: '极简专业',
    meta: '克制、信息密度高',
    voiceBias: '编辑部口径，结论先行。标题短、正文克制；不堆形容词。',
    bulletMaxLength: 28,
    bulletVisible: { compact: 2, standard: 3, detailed: 3, rich: 4 },
    recommendedThemes: ['mono', 'graphite', 'indigo'],
    layoutDistribution: { list: 0.5, stat: 0.3, quote: 0.2 },
    imageStyleBias: ['editorial', 'minimal'],
    eyebrowText: 'vCard · 资讯',
    closerStyle: 'quote',
    defaultTheme: 'mono',
    defaultImageStyle: 'editorial',
  },
  {
    id: 'magazine',
    name: '编辑杂志',
    meta: '杂志感、文学性',
    voiceBias: '杂志专题口径。允许稍长的标题与稍有节奏的正文，但不煽情、不堆排比。',
    bulletMaxLength: 36,
    bulletVisible: { compact: 2, standard: 3, detailed: 4, rich: 5 },
    recommendedThemes: ['paper', 'mono', 'sage'],
    layoutDistribution: { list: 0.4, quote: 0.4, stat: 0.2 },
    imageStyleBias: ['documentary', 'editorial', 'illustration'],
    eyebrowText: 'vCard · 专题',
    closerStyle: 'quote',
    defaultTheme: 'paper',
    defaultImageStyle: 'documentary',
  },
  {
    id: 'briefing',
    name: '资讯卡片',
    meta: '判断 + 数据 + 行动',
    voiceBias: '简报口径。每张卡都给一个判断或具体数字；多用名词与动词，少形容词。',
    bulletMaxLength: 24,
    bulletVisible: { compact: 2, standard: 3, detailed: 4, rich: 4 },
    recommendedThemes: ['mono', 'graphite', 'sage'],
    layoutDistribution: { stat: 0.5, list: 0.4, quote: 0.1 },
    imageStyleBias: ['minimal', 'abstract'],
    eyebrowText: 'vCard · 简报',
    closerStyle: 'list',
    defaultTheme: 'mono',
    defaultImageStyle: 'minimal',
  },
  {
    id: 'narrative',
    name: '故事化',
    meta: '叙事节奏、引用感',
    voiceBias: '叙事口径。按"起因 → 转折 → 收束"组织节奏；多用场景与引语，但不夸张。',
    bulletMaxLength: 36,
    bulletVisible: { compact: 2, standard: 3, detailed: 4, rich: 4 },
    recommendedThemes: ['paper', 'noir', 'indigo'],
    layoutDistribution: { quote: 0.5, list: 0.3, stat: 0.2 },
    imageStyleBias: ['illustration', 'documentary'],
    eyebrowText: 'vCard · 故事',
    closerStyle: 'quote',
    defaultTheme: 'paper',
    defaultImageStyle: 'illustration',
  },
];

export function resolveTemplate(template: string | undefined): TemplateSpec {
  if (!template) return TEMPLATES[0];
  const byId = TEMPLATES.find((t) => t.id === template);
  if (byId) return byId;
  const byName = TEMPLATES.find((t) => t.name === template);
  if (byName) return byName;
  return TEMPLATES[0];
}

// ============================================================
// Layout × Theme 兼容矩阵
// ============================================================

export type Compatibility = 'recommended' | 'allowed' | 'discouraged';

const COMPATIBILITY: Record<CardLayout, Record<ThemeId, Compatibility>> = {
  cover: {
    mono: 'recommended', paper: 'recommended', graphite: 'allowed',
    indigo: 'recommended', sage: 'allowed', noir: 'allowed',
  },
  list: {
    mono: 'recommended', paper: 'recommended', graphite: 'recommended',
    indigo: 'allowed', sage: 'recommended', noir: 'allowed',
  },
  quote: {
    mono: 'allowed', paper: 'recommended', graphite: 'allowed',
    indigo: 'allowed', sage: 'allowed', noir: 'recommended',
  },
  stat: {
    mono: 'recommended', paper: 'allowed', graphite: 'recommended',
    indigo: 'recommended', sage: 'recommended', noir: 'discouraged',
  },
  closer: {
    mono: 'recommended', paper: 'recommended', graphite: 'allowed',
    indigo: 'allowed', sage: 'recommended', noir: 'recommended',
  },
};

export function getCompatibility(layout: CardLayout, theme: string): Compatibility {
  return COMPATIBILITY[layout]?.[theme as ThemeId] ?? 'allowed';
}

/**
 * 综合 template 推荐 + 兼容矩阵给出整体评级。
 * - 兼容矩阵命中 'discouraged' → 永远 'discouraged'
 * - template 推荐 → 'recommended'
 * - 否则按 layout 兼容矩阵评级
 */
export function getThemeCompatibilityForTemplate(
  layout: CardLayout,
  theme: string,
  templateId: string | undefined,
): Compatibility {
  const baseline = getCompatibility(layout, theme);
  if (baseline === 'discouraged') return 'discouraged';
  const spec = resolveTemplate(templateId);
  if (spec.recommendedThemes.includes(theme as ThemeId)) return 'recommended';
  return baseline;
}
