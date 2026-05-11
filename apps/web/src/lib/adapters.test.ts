import { describe, expect, it } from 'vitest';
import {
  cardToFrontend,
  langToBackend,
  langToFrontend,
  settingsToBackend,
  settingsToFrontend,
  sizeToBackend,
  sizeToFrontend,
} from './adapters.js';

describe('adapters: language', () => {
  it('maps known frontend labels to backend codes', () => {
    expect(langToBackend('简体中文')).toBe('zh-CN');
    expect(langToBackend('繁體中文')).toBe('zh-TW');
    expect(langToBackend('English')).toBe('en');
    expect(langToBackend('日本語')).toBe('ja');
  });

  it('falls back to zh-CN for unknown labels', () => {
    expect(langToBackend('Klingon')).toBe('zh-CN');
  });

  it('round-trips known languages', () => {
    for (const label of ['简体中文', '繁體中文', 'English', '日本語'] as const) {
      expect(langToFrontend(langToBackend(label))).toBe(label);
    }
  });
});

describe('adapters: aspect ratio', () => {
  it('maps known sizes to ratios', () => {
    expect(sizeToBackend('1-1')).toBe('1:1');
    expect(sizeToBackend('4-5')).toBe('4:5');
    expect(sizeToBackend('9-16')).toBe('9:16');
  });

  it('falls back to 4:5 for unknown sizes', () => {
    expect(sizeToBackend('20-30')).toBe('4:5');
  });

  it('round-trips known ratios', () => {
    for (const id of ['1-1', '4-5', '9-16'] as const) {
      expect(sizeToFrontend(sizeToBackend(id))).toBe(id);
    }
  });
});

describe('adapters: card', () => {
  it('coerces backend card row to frontend shape', () => {
    const row = {
      id: 'card-1',
      deckId: 'deck-1',
      index: 0,
      title: 'cover',
      bullets: ['a', 'b'],
      layout: 'cover' as const,
      note: null,
      render: {},
      imagePrompt: null,
      imageUrl: null,
      userEdited: false,
      locked: false,
      version: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const front = cardToFrontend(row);
    expect(front).toEqual({
      id: 'card-1',
      title: 'cover',
      bullets: ['a', 'b'],
      layout: 'cover',
      note: undefined,
      version: 3,
      imageUrl: null,
    });
  });
});

describe('adapters: settings', () => {
  it('passes settings through unchanged', () => {
    const settings = {
      template: '极简专业',
      theme: 'mono',
      density: 'standard' as const,
      layout: '自动匹配',
      imageStyle: 'editorial',
    };
    expect(settingsToBackend(settings)).toEqual(settings);
    expect(settingsToFrontend(settings)).toEqual(settings);
  });
});
