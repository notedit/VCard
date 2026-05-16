import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api.js';
import { snapshotToStatePatch, buildDeckUpdatePayload, type AppState } from './state.js';

// 端到端：构造 mock fetch → api.createDeck → snapshotToStatePatch
// 验证前端用户提交后能拿到与后端一致的本地 state。

const sampleSnapshot = {
  deck: {
    id: '11111111-1111-1111-1111-111111111111',
    userId: 'user-1',
    title: 'Codex 新能力',
    prompt: 'Codex 最近两周',
    mode: 'html',
    cardCount: 2,
    aspectRatio: '4:5',
    language: 'zh-CN',
    settings: {
      template: '极简专业',
      theme: 'mono',
      density: 'standard',
      layout: '自动匹配',
      imageStyle: 'editorial',
    },
    status: 'outlined',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  cards: [
    {
      id: 'aa000000-0000-0000-0000-000000000001',
      deckId: '11111111-1111-1111-1111-111111111111',
      index: 0,
      title: '封面',
      bullets: ['先给结论'],
      layout: 'cover',
      note: null,
      render: {},
      imagePrompt: null,
      imageUrl: null,
      userEdited: false,
      locked: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'aa000000-0000-0000-0000-000000000002',
      deckId: '11111111-1111-1111-1111-111111111111',
      index: 1,
      title: '要点 1',
      bullets: ['说清变化'],
      layout: 'list',
      note: null,
      render: {},
      imagePrompt: null,
      imageUrl: null,
      userEdited: false,
      locked: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  latestGeneration: null,
  messages: [],
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(sampleSnapshot), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PageInput → createDeck → snapshotToStatePatch', () => {
  it('produces a state patch ready to drive PageOutline', async () => {
    const snapshot = await api.createDeck({
      userId: 'user-1',
      prompt: 'Codex 最近两周',
      mode: 'html',
      cardCount: 2,
      aspectRatio: '4:5',
      language: 'zh-CN',
      settings: {
        template: '极简专业',
        theme: 'mono',
        density: 'standard',
        layout: '自动匹配',
        imageStyle: 'editorial',
      },
    });

    const patch = snapshotToStatePatch(snapshot);
    expect(patch.deckId).toBe('11111111-1111-1111-1111-111111111111');
    expect(patch.outline).toHaveLength(2);
    expect(patch.outline?.[0]).toMatchObject({ id: 'aa000000-0000-0000-0000-000000000001', version: 1 });
    expect(patch.count).toBe(2);
    expect(patch.size).toBe('4-5');
    expect(patch.lang).toBe('简体中文');
  });

  it('round-trips state through buildDeckUpdatePayload back to backend shape', async () => {
    const snapshot = await api.createDeck({
      userId: 'user-1',
      prompt: 'Codex 最近两周',
      mode: 'html',
      cardCount: 2,
      aspectRatio: '4:5',
      language: 'zh-CN',
      settings: {},
    });
    const patch = snapshotToStatePatch(snapshot);
    const merged: AppState = {
      deckId: patch.deckId ?? null,
      mode: patch.mode!,
      count: patch.count!,
      size: patch.size!,
      template: patch.template!,
      lang: patch.lang!,
      prompt: patch.prompt!,
      outline: patch.outline ?? [],
      density: patch.density!,
      theme: patch.theme!,
      layout: patch.layout!,
      imageStyle: patch.imageStyle!,
    };
    const payload = buildDeckUpdatePayload(merged);
    expect(payload.aspectRatio).toBe('4:5');
    expect(payload.language).toBe('zh-CN');
    expect(payload.mode).toBe('html');
    expect(payload.cardCount).toBe(2);
    expect(payload.settings.template).toBe('极简专业');
  });
});
