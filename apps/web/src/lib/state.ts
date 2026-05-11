import type {
  AspectRatio,
  CardLayout,
  Deck,
  Density,
  Language,
  ThemeId,
} from '@vcard/shared-types';
import { ApiError } from './api.js';
import {
  cardToFrontend,
  langToBackend,
  langToFrontend,
  sizeToBackend,
  sizeToFrontend,
  type FrontendCard,
} from './adapters.js';

export type AppState = {
  deckId: string | null;
  mode: 'html' | 'image';
  count: number;
  size: '1-1' | '4-5' | '9-16';
  template: string;
  lang: string;
  prompt: string;
  outline: FrontendCard[];
  density: Density;
  theme: ThemeId;
  layout: string;
  imageStyle: string;
};

export type DeckSnapshotLike = {
  deck: Pick<Deck, 'id' | 'mode' | 'aspectRatio' | 'language' | 'prompt' | 'settings'>;
  cards: Array<Parameters<typeof cardToFrontend>[0]>;
};

export function snapshotToStatePatch(snapshot: DeckSnapshotLike): Partial<AppState> {
  const deck = snapshot.deck;
  const outline = snapshot.cards.map(cardToFrontend);
  return {
    deckId: deck.id,
    mode: deck.mode,
    count: outline.length,
    size: sizeToFrontend(deck.aspectRatio) as AppState['size'],
    template: deck.settings.template,
    lang: langToFrontend(deck.language),
    prompt: deck.prompt,
    outline,
    density: deck.settings.density,
    theme: deck.settings.theme as ThemeId,
    layout: deck.settings.layout,
    imageStyle: deck.settings.imageStyle,
  };
}

export type CardJobState = {
  cardId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
  finishedAt?: string;
};

export type ImageJobProgress = {
  total: number;
  done: number;
  failed: number;
  running: number;
  queued: number;
  ratio: number; // 0-1
  isComplete: boolean;
};

export function computeImageJobProgress(cardJobs: CardJobState[] | undefined | null): ImageJobProgress {
  const list = cardJobs ?? [];
  const total = list.length;
  let done = 0;
  let failed = 0;
  let running = 0;
  let queued = 0;
  for (const cj of list) {
    if (cj.status === 'done') done += 1;
    else if (cj.status === 'failed') failed += 1;
    else if (cj.status === 'running') running += 1;
    else queued += 1;
  }
  const finished = done + failed;
  return {
    total,
    done,
    failed,
    running,
    queued,
    ratio: total === 0 ? 0 : finished / total,
    isComplete: total > 0 && finished === total,
  };
}

export type DeckUpdatePayload = {
  mode: 'html' | 'image';
  cardCount: number;
  aspectRatio: AspectRatio;
  language: Language;
  prompt: string;
  settings: {
    template: string;
    theme: string;
    density: Density;
    layout: string;
    imageStyle: string;
  };
};

export function buildDeckUpdatePayload(state: AppState): DeckUpdatePayload {
  return {
    mode: state.mode,
    cardCount: state.count,
    aspectRatio: sizeToBackend(state.size),
    language: langToBackend(state.lang),
    prompt: state.prompt,
    settings: {
      template: state.template,
      theme: state.theme,
      density: state.density,
      layout: state.layout,
      imageStyle: state.imageStyle,
    },
  };
}

export function currentDeckTitle(
  state: Pick<AppState, 'deckId' | 'prompt'>,
  decks: Array<{ id: string; title: string }>,
): string {
  if (state.deckId) {
    const found = decks.find((d) => d.id === state.deckId);
    if (found) return found.title;
  }
  if (state.prompt) {
    const trimmed = state.prompt.trim().replace(/\s+/g, ' ');
    return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed || '未命名卡组';
  }
  return '未命名卡组';
}

export function chatTargetLabel(cardId: string | null, outline: FrontendCard[]): string | undefined {
  if (cardId === null) return '整套卡片';
  const index = outline.findIndex((c) => c.id === cardId);
  if (index < 0) return undefined;
  return `卡片 #${String(index + 1).padStart(2, '0')}`;
}

export function humanizeApiError(err: ApiError): string {
  if (err.status === 0 || err.message === 'Failed to fetch') return '无法连接 API（确认 apps/api 已启动且 VITE_API_URL 正确）';
  if (err.status === 409 && err.message === 'version_conflict') return '远端已被更新，请刷新后再试';
  if (err.status === 400) return `请求参数有误：${err.message}`;
  if (err.status >= 500) return 'API 暂时不可用，稍后再试';
  return `生成失败：${err.message}`;
}

export type CardLayoutId = CardLayout;
