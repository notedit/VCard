import { describe, expect, it } from 'vitest';
import {
  buildDeckUpdatePayload,
  chatTargetLabel,
  computeImageJobProgress,
  currentDeckTitle,
  humanizeApiError,
  snapshotToStatePatch,
  type AppState,
  type CardJobState,
} from './state.js';
import { ApiError } from './api.js';
import type { FrontendCard } from './adapters.js';

const baseState: AppState = {
  deckId: 'deck-uuid',
  mode: 'html',
  count: 3,
  size: '4-5',
  template: '极简专业',
  lang: '简体中文',
  prompt: 'demo prompt',
  outline: [],
  density: 'standard',
  theme: 'mono',
  layout: '自动匹配',
  imageStyle: 'editorial',
};

describe('buildDeckUpdatePayload', () => {
  it('maps frontend state to backend payload', () => {
    const payload = buildDeckUpdatePayload(baseState);
    expect(payload).toEqual({
      mode: 'html',
      cardCount: 3,
      aspectRatio: '4:5',
      language: 'zh-CN',
      prompt: 'demo prompt',
      settings: {
        template: '极简专业',
        theme: 'mono',
        density: 'standard',
        layout: '自动匹配',
        imageStyle: 'editorial',
      },
    });
  });

  it('translates English language and 9-16 ratio', () => {
    const payload = buildDeckUpdatePayload({ ...baseState, lang: 'English', size: '9-16' });
    expect(payload.language).toBe('en');
    expect(payload.aspectRatio).toBe('9:16');
  });
});

describe('snapshotToStatePatch', () => {
  it('produces a partial AppState matching the snapshot', () => {
    const snapshot = {
      deck: {
        id: 'deck-1',
        mode: 'image' as const,
        aspectRatio: '1:1' as const,
        language: 'ja' as const,
        prompt: 'p',
        settings: {
          template: '编辑杂志',
          theme: 'paper',
          density: 'detailed' as const,
          layout: '杂志混排',
          imageStyle: 'editorial',
        },
      },
      cards: [
        {
          id: 'c1',
          deckId: 'deck-1',
          index: 0,
          title: 'cover',
          bullets: ['x'],
          layout: 'cover' as const,
          note: null,
          render: {},
          imagePrompt: null,
          imageUrl: null,
          userEdited: false,
          locked: false,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    const patch = snapshotToStatePatch(snapshot);
    expect(patch.deckId).toBe('deck-1');
    expect(patch.mode).toBe('image');
    expect(patch.size).toBe('1-1');
    expect(patch.lang).toBe('日本語');
    expect(patch.prompt).toBe('p');
    expect(patch.template).toBe('编辑杂志');
    expect(patch.theme).toBe('paper');
    expect(patch.density).toBe('detailed');
    expect(patch.imageStyle).toBe('editorial');
    expect(patch.layout).toBe('杂志混排');
    expect(patch.outline).toHaveLength(1);
    expect(patch.outline?.[0].id).toBe('c1');
    expect(patch.count).toBe(1);
  });
});

describe('chatTargetLabel', () => {
  const outline: FrontendCard[] = [
    { id: 'c1', title: 'a', bullets: [], layout: 'cover' },
    { id: 'c2', title: 'b', bullets: [], layout: 'list' },
  ];

  it('returns "整套卡片" for null cardId', () => {
    expect(chatTargetLabel(null, outline)).toBe('整套卡片');
  });

  it('formats card index padded to 2 digits', () => {
    expect(chatTargetLabel('c1', outline)).toBe('卡片 #01');
    expect(chatTargetLabel('c2', outline)).toBe('卡片 #02');
  });

  it('returns undefined when cardId not found', () => {
    expect(chatTargetLabel('missing', outline)).toBeUndefined();
  });
});

describe('currentDeckTitle', () => {
  it('returns the deck title from the list when deckId matches', () => {
    expect(
      currentDeckTitle({ deckId: 'd1', prompt: '主题' }, [
        { id: 'd0', title: 'A' },
        { id: 'd1', title: '我的卡组' },
      ]),
    ).toBe('我的卡组');
  });

  it('falls back to a trimmed prompt when no deckId match', () => {
    expect(currentDeckTitle({ deckId: null, prompt: '   一段较短的主题   ' }, [])).toBe('一段较短的主题');
  });

  it('truncates long prompts to 24 chars with ellipsis', () => {
    const long = 'a'.repeat(40);
    const result = currentDeckTitle({ deckId: null, prompt: long }, []);
    expect(result.length).toBe(25);
    expect(result.endsWith('…')).toBe(true);
  });

  it('falls back to placeholder for empty prompt', () => {
    expect(currentDeckTitle({ deckId: null, prompt: '' }, [])).toBe('未命名卡组');
    expect(currentDeckTitle({ deckId: null, prompt: '   ' }, [])).toBe('未命名卡组');
  });
});

describe('computeImageJobProgress', () => {
  const make = (statuses: CardJobState['status'][]): CardJobState[] =>
    statuses.map((status, i) => ({ cardId: `c${i}`, status }));

  it('handles undefined / empty', () => {
    const a = computeImageJobProgress(undefined);
    expect(a).toMatchObject({ total: 0, ratio: 0, isComplete: false });
    const b = computeImageJobProgress([]);
    expect(b.total).toBe(0);
    expect(b.isComplete).toBe(false);
  });

  it('counts each status bucket', () => {
    const r = computeImageJobProgress(make(['queued', 'running', 'done', 'done', 'failed']));
    expect(r.total).toBe(5);
    expect(r.queued).toBe(1);
    expect(r.running).toBe(1);
    expect(r.done).toBe(2);
    expect(r.failed).toBe(1);
  });

  it('ratio = (done + failed) / total', () => {
    const r = computeImageJobProgress(make(['done', 'failed', 'queued', 'queued']));
    expect(r.ratio).toBe(0.5);
    expect(r.isComplete).toBe(false);
  });

  it('isComplete=true when every card finished (done or failed)', () => {
    const r = computeImageJobProgress(make(['done', 'done', 'failed']));
    expect(r.ratio).toBe(1);
    expect(r.isComplete).toBe(true);
  });
});

describe('humanizeApiError', () => {
  it('describes network failures', () => {
    const err = new ApiError(0, null, 'Failed to fetch');
    expect(humanizeApiError(err)).toContain('无法连接');
  });

  it('describes optimistic-lock conflict', () => {
    const err = new ApiError(409, null, 'version_conflict');
    expect(humanizeApiError(err)).toContain('远端已被更新');
  });

  it('exposes 400 message inline', () => {
    const err = new ApiError(400, null, 'bad_input');
    expect(humanizeApiError(err)).toContain('请求参数有误');
    expect(humanizeApiError(err)).toContain('bad_input');
  });

  it('describes 5xx as unavailable', () => {
    const err = new ApiError(503, null, 'svc_down');
    expect(humanizeApiError(err)).toContain('暂时不可用');
  });
});
