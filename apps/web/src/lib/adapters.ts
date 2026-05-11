import type {
  AspectRatio,
  Card,
  CardLayout,
  Deck,
  DeckSettings,
  Density,
  Language,
} from '@vcard/shared-types';

// 前端 UI 字段 ⇄ 后端 schema 字段的映射。
// 仅在网络边界做转换，App.tsx 内仍用前端友好字串。

const LANG_TO_BACKEND: Record<string, Language> = {
  '简体中文': 'zh-CN',
  '繁體中文': 'zh-TW',
  English: 'en',
  日本語: 'ja',
};

const LANG_TO_FRONTEND: Record<Language, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
};

const SIZE_TO_BACKEND: Record<string, AspectRatio> = {
  '1-1': '1:1',
  '4-5': '4:5',
  '9-16': '9:16',
};

const SIZE_TO_FRONTEND: Record<AspectRatio, string> = {
  '1:1': '1-1',
  '4:5': '4-5',
  '9:16': '9-16',
};

export function langToBackend(lang: string): Language {
  return LANG_TO_BACKEND[lang] ?? 'zh-CN';
}

export function langToFrontend(lang: Language): string {
  return LANG_TO_FRONTEND[lang] ?? '简体中文';
}

export function sizeToBackend(size: string): AspectRatio {
  return SIZE_TO_BACKEND[size] ?? '4:5';
}

export function sizeToFrontend(ratio: AspectRatio): string {
  return SIZE_TO_FRONTEND[ratio] ?? '4-5';
}

export type FrontendCard = {
  id: string;
  title: string;
  bullets: string[];
  layout: CardLayout;
  note?: string;
  version?: number;
  imageUrl?: string | null;
};

export function cardToFrontend(card: Card): FrontendCard {
  return {
    id: card.id,
    title: card.title,
    bullets: card.bullets,
    layout: card.layout,
    note: card.note ?? undefined,
    version: card.version,
    imageUrl: card.imageUrl,
  };
}

export type SettingsLike = {
  template: string;
  theme: string;
  density: Density;
  layout: string;
  imageStyle: string;
};

export function settingsToBackend(input: SettingsLike): DeckSettings {
  return {
    template: input.template,
    theme: input.theme,
    density: input.density,
    layout: input.layout,
    imageStyle: input.imageStyle,
  };
}

export function settingsToFrontend(settings: DeckSettings): SettingsLike {
  return {
    template: settings.template,
    theme: settings.theme,
    density: settings.density,
    layout: settings.layout,
    imageStyle: settings.imageStyle,
  };
}

export type DeckSnapshot = {
  deck: Deck;
  cards: Card[];
};
