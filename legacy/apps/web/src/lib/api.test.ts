import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api.js';

type FetchInput = { url: string; init: RequestInit };

let calls: FetchInput[] = [];
let nextResponse: { status: number; body: unknown };

function setResponse(status: number, body: unknown) {
  nextResponse = { status, body };
}

beforeEach(() => {
  calls = [];
  nextResponse = { status: 200, body: {} };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), init: init ?? {} });
    return new Response(JSON.stringify(nextResponse.body), {
      status: nextResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('createDeck POSTs to /decks with the correct payload and returns parsed body', async () => {
    const snapshot = {
      deck: { id: 'deck-1' },
      cards: [],
      latestGeneration: null,
      messages: [],
    };
    setResponse(201, snapshot);
    const result = await api.createDeck({
      userId: 'user-1',
      prompt: 'hi',
      mode: 'html',
      cardCount: 3,
      aspectRatio: '4:5',
      language: 'zh-CN',
      settings: {},
    });
    expect(result).toEqual(snapshot);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain('/decks');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toContain('"userId":"user-1"');
    expect(calls[0].init.body).toContain('"prompt":"hi"');
  });

  it('throws ApiError when server returns non-2xx', async () => {
    setResponse(400, { error: 'invalid_request' });
    await expect(
      api.createDeck({
        userId: 'u',
        prompt: 'x',
        mode: 'html',
        cardCount: 1,
        aspectRatio: '4:5',
        language: 'zh-CN',
        settings: {},
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('wraps network errors as ApiError(status=0)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    try {
      await api.getDeck('deck-1');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
    }
  });

  it('patchCard sends version + path includes ids', async () => {
    setResponse(200, { id: 'card-1', version: 4, title: 'x', bullets: [], layout: 'list' });
    await api.patchCard('deck-1', 'card-1', { version: 3, title: 'x' });
    expect(calls[0].url).toContain('/decks/deck-1/cards/card-1');
    expect(calls[0].init.method).toBe('PATCH');
    expect(calls[0].init.body).toContain('"version":3');
  });

  it('reorderCards uses the right URL and order array', async () => {
    setResponse(200, { deck: {}, cards: [], latestGeneration: null, messages: [] });
    await api.reorderCards('deck-1', ['c1', 'c2']);
    expect(calls[0].url).toContain('/decks/deck-1/cards/reorder');
    expect(calls[0].init.method).toBe('PATCH');
    expect(calls[0].init.body).toContain('"order":["c1","c2"]');
  });

  it('getGenerationJob calls /decks/:id/generations/:jobId', async () => {
    setResponse(200, { job: { id: 'j1', status: 'running', result: { cardJobs: [] } } });
    const res = await api.getGenerationJob('deck-1', 'j1');
    expect(calls[0].url).toContain('/decks/deck-1/generations/j1');
    expect(res.job.id).toBe('j1');
  });

  it('exportDeck POSTs to /export', async () => {
    setResponse(200, { deck: { id: 'deck-1' }, cards: [], exportedAt: 'now', files: [] });
    await api.exportDeck('deck-1');
    expect(calls[0].url).toContain('/decks/deck-1/export');
    expect(calls[0].init.method).toBe('POST');
  });

  it('listDecks encodes userId in querystring', async () => {
    setResponse(200, { decks: [] });
    await api.listDecks('a/b c');
    expect(calls[0].url).toContain('userId=a%2Fb%20c');
  });
});
