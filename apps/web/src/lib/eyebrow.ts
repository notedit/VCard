import type { CardLayout, TemplateSpec } from '@vcard/shared-types';

// eyebrow 文案按 layout 选择，让 5 种 layout 在视觉上一眼可辨。
// cover / closer 由位置决定（不被 layout 字段覆盖），中间卡按 layout 走。
// 序号信息只在 footer 页码显示一次，不再出现 "01 · 要点" 这种千篇一律的 eyebrow。

export const LAYOUT_EYEBROW: Record<CardLayout, string> = {
  cover: '封面',
  list: '要点',
  quote: '观点',
  stat: '数据',
  closer: '结语',
};

export function eyebrowFor(
  card: { layout?: CardLayout },
  isCover: boolean,
  isCloser: boolean,
  spec: TemplateSpec,
): string {
  if (isCover) return spec.eyebrowText; // cover 保持 brand 文案，如 "vCard · 资讯"
  if (isCloser) return LAYOUT_EYEBROW.closer;
  const role: CardLayout = card.layout ?? 'list';
  return LAYOUT_EYEBROW[role];
}
