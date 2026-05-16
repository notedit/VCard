export * from './design-system.js';

export type DeckMode = 'html' | 'image';
export type DeckStatus = 'draft' | 'outlined' | 'styled' | 'generating' | 'ready' | 'exported';
export type AspectRatio = '1:1' | '4:5' | '9:16';
export type Language = 'zh-CN' | 'zh-TW' | 'en' | 'ja';
export type CardLayout = 'cover' | 'list' | 'quote' | 'stat' | 'closer';
export type Density = 'compact' | 'standard' | 'detailed' | 'rich';
export type GenerationStatus = 'queued' | 'running' | 'done' | 'failed';
export type ChatRole = 'user' | 'assistant';
export type ActivityActor = 'user' | 'assistant' | 'system';
export type ActivityTarget = 'deck' | 'card' | 'generation' | 'chat';

export interface DeckSettings {
  template: string;
  theme: string;
  density: Density;
  layout: string;
  imageStyle: string;
}

export interface Deck {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  mode: DeckMode;
  cardCount: number;
  aspectRatio: AspectRatio;
  language: Language;
  settings: DeckSettings;
  status: DeckStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Card {
  id: string;
  deckId: string;
  index: number;
  title: string;
  bullets: string[];
  layout: CardLayout;
  note: string | null;
  render: Record<string, unknown>;
  imagePrompt: string | null;
  imageUrl: string | null;
  userEdited: boolean;
  locked: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationJob {
  id: string;
  deckId: string;
  mode: DeckMode;
  status: GenerationStatus;
  requested: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ChatActionPatch {
  title?: string;
  bullets?: string[];
}

export interface ChatAction {
  label: string;
  kind: 'title' | 'bullet' | 'tone';
  applied?: boolean;
  /**
   * 由 LLM 提议的具体修改内容。点击 action 时直接落库，不再走任何字符串规则。
   * - title 类 action：必须含 title
   * - bullet 类 action：必须含 bullets（完整新数组）
   * - tone 类 action：通常含 title（重写更克制的版本）
   */
  patch?: ChatActionPatch;
}

export interface ChatMessage {
  id: string;
  deckId: string;
  cardId: string | null;
  role: ChatRole;
  body: string;
  actions: ChatAction[];
  createdAt: Date;
}

export interface ActivityLog {
  id: string;
  deckId: string;
  actor: ActivityActor;
  target: ActivityTarget;
  targetId: string | null;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}
