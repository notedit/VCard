import { describe, expect, it } from 'vitest';
import { buildImageClient, buildPlaceholderDataUrl, composePrompt, generateCardImage } from '../src/image/gen-image.js';

const baseSettings = {
  template: '极简专业',
  theme: 'mono',
  density: 'standard' as const,
  layout: '自动匹配',
  imageStyle: 'editorial',
};

describe('composePrompt', () => {
  it('combines style, topic and title into a single english prompt', () => {
    const prompt = composePrompt({
      cardTitle: 'Codex 重新定义编程',
      settings: baseSettings,
      prompt: 'Codex 新能力',
    });
    expect(prompt).toContain('editorial');
    expect(prompt).toContain('Codex 新能力');
    expect(prompt).toContain('Codex 重新定义编程');
    expect(prompt).toContain('no embedded text');
  });
});

describe('buildPlaceholderDataUrl', () => {
  it('returns a base64-encoded SVG data URL', () => {
    const url = buildPlaceholderDataUrl({
      cardTitle: 'cover',
      cardIndex: 0,
      aspectRatio: '4:5',
      settings: baseSettings,
    });
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = Buffer.from(url.split(',')[1], 'base64').toString('utf-8');
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('cover');
  });

  it('escapes XML-special chars in card title', () => {
    const url = buildPlaceholderDataUrl({
      cardTitle: 'A & B <c>',
      cardIndex: 0,
      aspectRatio: '1:1',
      settings: baseSettings,
    });
    const decoded = Buffer.from(url.split(',')[1], 'base64').toString('utf-8');
    expect(decoded).toContain('A &amp; B &lt;c&gt;');
    expect(decoded).not.toContain('A & B <c>');
  });

  it('uses different gradients for different card indexes', () => {
    const a = buildPlaceholderDataUrl({ cardTitle: 't', cardIndex: 0, aspectRatio: '1:1', settings: baseSettings });
    const b = buildPlaceholderDataUrl({ cardTitle: 't', cardIndex: 2, aspectRatio: '1:1', settings: baseSettings });
    expect(a).not.toBe(b);
  });
});

describe('buildImageClient', () => {
  it('returns null when no key is present', () => {
    expect(buildImageClient({})).toBeNull();
    expect(buildImageClient({ AIHUBMIX_API_KEY: '', OPENAI_API_KEY: '' })).toBeNull();
  });

  it('prefers AIHubMix when both keys are set', () => {
    const built = buildImageClient({ AIHUBMIX_API_KEY: 'aih', OPENAI_API_KEY: 'oai' });
    expect(built?.source).toBe('aihubmix');
    expect(built?.client.baseURL).toBe('https://aihubmix.com/v1');
  });

  it('falls back to OpenAI direct when only OPENAI_API_KEY is set', () => {
    const built = buildImageClient({ OPENAI_API_KEY: 'oai' });
    expect(built?.source).toBe('openai');
    expect(built?.client.baseURL).toBe('https://api.openai.com/v1');
  });
});

describe('generateCardImage', () => {
  it('returns a placeholder when both AIHUBMIX_API_KEY and OPENAI_API_KEY are missing', async () => {
    const result = await generateCardImage({
      prompt: 'Codex',
      cardTitle: '封面',
      cardIndex: 0,
      aspectRatio: '4:5',
      settings: baseSettings,
      env: {},
    });
    expect(result.source).toBe('placeholder');
    expect(result.imageUrl.startsWith('data:image/svg+xml')).toBe(true);
    expect(result.imagePrompt).toContain('封面');
  });

  it('still placeholders when env keys are explicitly empty strings', async () => {
    const result = await generateCardImage({
      prompt: 'Codex',
      cardTitle: '封面',
      cardIndex: 0,
      aspectRatio: '4:5',
      settings: baseSettings,
      env: { AIHUBMIX_API_KEY: '', OPENAI_API_KEY: '' },
    });
    expect(result.source).toBe('placeholder');
  });
});
