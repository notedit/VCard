import type {
  AspectRatio,
  Card,
  CardLayout,
  ChatMessage,
  Deck,
  DeckMode,
  DeckSettings,
  GenerationJob,
  Language,
} from '@vcard/shared-types';

const API_BASE = ((import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE) as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8787';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiError(0, null, err instanceof Error ? err.message : 'network_error');
  }
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const message = (json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string')
      ? (json as { error: string }).error
      : `HTTP ${res.status}`;
    throw new ApiError(res.status, json, message);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type DeckSnapshotResponse = {
  deck: Deck;
  cards: Card[];
  latestGeneration: GenerationJob | null;
  messages: ChatMessage[];
};

export type CreateDeckPayload = {
  userId: string;
  prompt: string;
  mode: DeckMode;
  cardCount: number;
  aspectRatio: AspectRatio;
  language: Language;
  settings: Partial<DeckSettings>;
  title?: string;
};

export type UpdateDeckPayload = {
  title?: string;
  prompt?: string;
  mode?: DeckMode;
  cardCount?: number;
  aspectRatio?: AspectRatio;
  language?: Language;
  settings?: Partial<DeckSettings>;
};

export type UpsertOutlinePayload = {
  prompt?: string;
  cardCount?: number;
  cards?: Array<{ title: string; bullets: string[]; layout: CardLayout; note?: string }>;
};

export type CreateCardPayload = {
  index?: number;
  title?: string;
  bullets?: string[];
  layout?: CardLayout;
  note?: string;
};

export type PatchCardPayload = {
  version: number;
  title?: string;
  bullets?: string[];
  layout?: CardLayout;
  note?: string | null;
  locked?: boolean;
};

export type GeneratePayload = {
  mode?: DeckMode;
  cardIds?: string[];
};

export type ChatPayload = {
  cardId?: string | null;
  message: string;
};

export type ChatApplyPayload = {
  cardId: string;
  action: 'title' | 'bullet' | 'tone';
  version: number;
  patch: { title?: string; bullets?: string[] };
};

export const api = {
  createDeck: (payload: CreateDeckPayload) =>
    request<DeckSnapshotResponse>('/decks', { method: 'POST', body: JSON.stringify(payload) }),

  getDeck: (deckId: string) =>
    request<DeckSnapshotResponse>(`/decks/${deckId}`),

  listDecks: (userId: string) =>
    request<{ decks: Deck[] }>(`/decks?userId=${encodeURIComponent(userId)}`),

  updateDeck: (deckId: string, payload: UpdateDeckPayload) =>
    request<DeckSnapshotResponse>(`/decks/${deckId}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  upsertOutline: (deckId: string, payload: UpsertOutlinePayload) =>
    request<DeckSnapshotResponse>(`/decks/${deckId}/outline`, { method: 'POST', body: JSON.stringify(payload) }),

  createCard: (deckId: string, payload: CreateCardPayload) =>
    request<Card>(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify(payload) }),

  patchCard: (deckId: string, cardId: string, payload: PatchCardPayload) =>
    request<Card>(`/decks/${deckId}/cards/${cardId}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteCard: (deckId: string, cardId: string) =>
    request<DeckSnapshotResponse>(`/decks/${deckId}/cards/${cardId}`, { method: 'DELETE' }),

  reorderCards: (deckId: string, order: string[]) =>
    request<DeckSnapshotResponse>(`/decks/${deckId}/cards/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ order }),
    }),

  generate: (deckId: string, payload: GeneratePayload = {}) =>
    request<{ job: GenerationJob; deck: DeckSnapshotResponse }>(`/decks/${deckId}/generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getGenerationJob: (deckId: string, jobId: string) =>
    request<{ job: GenerationJob }>(`/decks/${deckId}/generations/${jobId}`),

  getChat: (deckId: string) =>
    request<{ messages: ChatMessage[] }>(`/decks/${deckId}/chat`),

  postChat: (deckId: string, payload: ChatPayload) =>
    request<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>(`/decks/${deckId}/chat`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  applyChat: (deckId: string, payload: ChatApplyPayload) =>
    request<Card>(`/decks/${deckId}/chat/apply`, { method: 'POST', body: JSON.stringify(payload) }),

  exportDeck: (deckId: string) =>
    request<DeckSnapshotResponse & { exportedAt: string; files: Array<{ name: string; card: Card }> }>(`/decks/${deckId}/export`, { method: 'POST' }),
};
