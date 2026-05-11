import { describe, expect, it } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import { extractJsonObject, generateOutline, lintCards, stripSlop } from '../src/llm/outline.js';

function makeUsage() {
  return {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 10, text: 10, reasoning: 0 },
    totalTokens: 20,
  };
}

function makeTextOnlyModel(text: string): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: makeUsage(),
      warnings: [],
    }),
  });
}

function makeSequentialModel(texts: string[]): { model: MockLanguageModelV3; calls: () => number } {
  let i = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async (): Promise<LanguageModelV3GenerateResult> => {
      const text = texts[Math.min(i, texts.length - 1)];
      i += 1;
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: makeUsage(),
        warnings: [],
      };
    },
  });
  return { model, calls: () => i };
}

describe('extractJsonObject', () => {
  it('pulls JSON out of a fenced code block', () => {
    const text = 'Here you go:\n```json\n{"cards":[{"title":"A","bullets":["x"],"layout":"cover"}]}\n```\nDone.';
    const json = extractJsonObject(text);
    expect(JSON.parse(json)).toEqual({ cards: [{ title: 'A', bullets: ['x'], layout: 'cover' }] });
  });

  it('pulls JSON out of plain text via brace balancing', () => {
    const text = 'Result: {"cards":[{"title":"含{大括号}","bullets":["1"],"layout":"list"}]} thanks';
    const json = extractJsonObject(text);
    expect(JSON.parse(json).cards[0].title).toBe('含{大括号}');
  });

  it('throws when no JSON object is present', () => {
    expect(() => extractJsonObject('no braces here')).toThrowError(/no_json_in_llm_output/);
  });
});

describe('generateOutline', () => {
  it('parses cards from a mock model and pads to count', async () => {
    const llmJson = JSON.stringify({
      cards: [
        { title: 'Codex 是什么', bullets: ['一个云端代理', '负责改代码'], layout: 'cover' },
        { title: '能力 1', bullets: ['并行任务'], layout: 'list' },
        { title: '总结', bullets: ['它是工程同事'], layout: 'closer' },
      ],
    });
    const cards = await generateOutline({
      prompt: '介绍 OpenAI Codex',
      count: 5,
      language: 'zh-CN',
      settings: { template: '极简专业', theme: 'mono', density: 'standard', layout: '自动匹配', imageStyle: 'editorial' },
      env: { AIHUBMIX_API_KEY: 'test', TAVILY_API_KEY: undefined },
      model: makeTextOnlyModel(llmJson),
    });

    expect(cards).toHaveLength(5);
    expect(cards[0]).toEqual({ title: 'Codex 是什么', bullets: ['一个云端代理', '负责改代码'], layout: 'cover' });
    expect(cards[2]).toEqual({ title: '总结', bullets: ['它是工程同事'], layout: 'closer' });
    expect(cards.slice(3).every((card) => card.layout === 'list')).toBe(true);
  });

  it('trims when LLM produces too many cards', async () => {
    const llmJson = JSON.stringify({
      cards: Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, bullets: [`B${i}`], layout: i === 0 ? 'cover' : 'list' })),
    });
    const cards = await generateOutline({
      prompt: '主题',
      count: 4,
      language: 'zh-CN',
      settings: { template: '极简专业', theme: 'mono', density: 'standard', layout: '自动匹配', imageStyle: 'editorial' },
      env: { AIHUBMIX_API_KEY: 'test' },
      model: makeTextOnlyModel(llmJson),
    });

    expect(cards).toHaveLength(4);
    expect(cards[0].title).toBe('T0');
    expect(cards[3].title).toBe('T3');
  });

  it('retries once when output triggers anti-slop blacklist', async () => {
    const dirty = JSON.stringify({
      cards: [
        { title: '破圈！家人们，YYDS', bullets: ['一文带你看懂'], layout: 'cover' },
        { title: '能力总览', bullets: ['可执行的判断'], layout: 'list' },
        { title: '总结', bullets: ['继续观察'], layout: 'closer' },
      ],
    });
    const clean = JSON.stringify({
      cards: [
        { title: '为什么这次值得关注', bullets: ['核心能力的边界发生位移'], layout: 'cover' },
        { title: '能力总览', bullets: ['可执行的判断'], layout: 'list' },
        { title: '一句话收束', bullets: ['继续观察 3 个月'], layout: 'closer' },
      ],
    });
    const { model, calls } = makeSequentialModel([dirty, clean]);

    const cards = await generateOutline({
      prompt: '介绍新工具',
      count: 3,
      language: 'zh-CN',
      settings: { template: '极简专业', theme: 'mono', density: 'standard', layout: '自动匹配', imageStyle: 'editorial' },
      env: { AIHUBMIX_API_KEY: 'test' },
      model,
    });

    expect(calls()).toBe(2);
    expect(cards[0].title).toBe('为什么这次值得关注');
    expect(cards.some((c) => /破圈|家人们|yyds|一文带你/i.test(c.title + c.bullets.join('')))).toBe(false);
  });

  it('strips slop words when retry still produces blacklist hits', async () => {
    const dirty1 = JSON.stringify({
      cards: [
        { title: '破圈神器', bullets: ['赋能创作者'], layout: 'cover' },
        { title: '总结', bullets: ['继续观察'], layout: 'closer' },
      ],
    });
    const dirty2 = JSON.stringify({
      cards: [
        { title: '破圈神器', bullets: ['赋能创作者'], layout: 'cover' },
        { title: '总结', bullets: ['继续观察'], layout: 'closer' },
      ],
    });
    const { model, calls } = makeSequentialModel([dirty1, dirty2]);

    const cards = await generateOutline({
      prompt: '介绍新工具',
      count: 2,
      language: 'zh-CN',
      settings: { template: '极简专业', theme: 'mono', density: 'standard', layout: '自动匹配', imageStyle: 'editorial' },
      env: { AIHUBMIX_API_KEY: 'test' },
      model,
    });

    expect(calls()).toBe(2);
    expect(cards[0].title).not.toContain('破圈');
    expect(cards[0].bullets[0]).not.toContain('赋能');
  });
});

describe('lintCards', () => {
  it('detects A-class blacklist words in titles and bullets', () => {
    const { hits } = lintCards([
      { title: '破圈神器', bullets: ['赋能创作者'], layout: 'cover' },
      { title: '正常标题', bullets: ['正常要点'], layout: 'list' },
    ]);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some((h) => h.match === '破圈')).toBe(true);
    expect(hits.some((h) => h.match === '赋能')).toBe(true);
    expect(hits.some((h) => h.cardIndex === 1)).toBe(false);
  });

  it('detects D-class punctuation patterns', () => {
    const { hits } = lintCards([{ title: '太厉害了！！！', bullets: ['正常'], layout: 'cover' }]);
    expect(hits.some((h) => /[！!]{2,}/.test(h.match))).toBe(true);
  });

  it('returns no hits for clean content', () => {
    const { hits } = lintCards([
      { title: '一段克制的标题', bullets: ['具体判断与数据点'], layout: 'cover' },
    ]);
    expect(hits).toHaveLength(0);
  });
});

describe('stripSlop', () => {
  it('removes blacklist words from titles and bullets', () => {
    const out = stripSlop([
      { title: '破圈方案', bullets: ['深度好文，赋能创作者'], layout: 'cover' },
    ]);
    expect(out[0].title).not.toContain('破圈');
    expect(out[0].bullets[0]).not.toContain('深度好文');
    expect(out[0].bullets[0]).not.toContain('赋能');
  });

  it('collapses double exclamation marks to a single full stop', () => {
    const out = stripSlop([{ title: '惊艳！！', bullets: ['x'], layout: 'cover' }]);
    expect(out[0].title).toBe('惊艳。');
  });
});

describe('generateOutline · template spec injection', () => {
  it('routes different templates to different system prompts', async () => {
    const captured: string[] = [];
    const json = JSON.stringify({
      cards: [
        { title: '封面', bullets: ['x'], layout: 'cover' },
        { title: '收尾', bullets: ['y'], layout: 'closer' },
      ],
    });

    const makeCapturingModel = () =>
      new MockLanguageModelV3({
        doGenerate: async (options): Promise<LanguageModelV3GenerateResult> => {
          // 系统提示在 V3 协议下作为独立的 system 字段或第一条 message 出现
          const optsAny = options as { prompt?: unknown; system?: string };
          const systemSnapshot =
            optsAny.system ??
            (Array.isArray(optsAny.prompt)
              ? JSON.stringify(optsAny.prompt)
              : JSON.stringify(options));
          captured.push(systemSnapshot);
          return {
            content: [{ type: 'text', text: json }],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: makeUsage(),
            warnings: [],
          };
        },
      });

    await generateOutline({
      prompt: '主题',
      count: 2,
      language: 'zh-CN',
      settings: { template: '资讯卡片', theme: 'mono', density: 'standard', layout: '自动匹配', imageStyle: 'editorial' },
      env: { AIHUBMIX_API_KEY: 'test' },
      model: makeCapturingModel(),
    });

    await generateOutline({
      prompt: '主题',
      count: 2,
      language: 'zh-CN',
      settings: { template: '故事化', theme: 'paper', density: 'standard', layout: '自动匹配', imageStyle: 'illustration' },
      env: { AIHUBMIX_API_KEY: 'test' },
      model: makeCapturingModel(),
    });

    expect(captured.length).toBeGreaterThanOrEqual(2);
    const briefingPrompt = captured[0];
    const narrativePrompt = captured[1];
    expect(briefingPrompt).toContain('简报');
    expect(narrativePrompt).toContain('叙事');
    expect(briefingPrompt).not.toContain('叙事节奏');
    expect(narrativePrompt).not.toContain('情报简报');
  });

  it('formats layoutDistribution as middle-card hint in user prompt', async () => {
    const userMessages: string[] = [];
    const json = JSON.stringify({
      cards: [
        { title: '封面', bullets: ['a'], layout: 'cover' },
        { title: '中间', bullets: ['b'], layout: 'list' },
        { title: '收尾', bullets: ['c'], layout: 'closer' },
      ],
    });

    const model = new MockLanguageModelV3({
      doGenerate: async (options): Promise<LanguageModelV3GenerateResult> => {
        const optsAny = options as { prompt?: unknown };
        const promptStr = JSON.stringify(optsAny.prompt ?? '');
        userMessages.push(promptStr);
        return {
          content: [{ type: 'text', text: json }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: makeUsage(),
          warnings: [],
        };
      },
    });

    await generateOutline({
      prompt: '主题',
      count: 5,
      language: 'zh-CN',
      settings: { template: '资讯卡片', theme: 'mono', density: 'standard', layout: '自动匹配', imageStyle: 'editorial' },
      env: { AIHUBMIX_API_KEY: 'test' },
      model,
    });

    const combined = userMessages.join('\n');
    // briefing template: stat 50% / list 40% / quote 10%, middle = 5-2 = 3 张
    expect(combined).toMatch(/stat ≈ \d+ 张/);
    expect(combined).toMatch(/closer 倾向：list 行动建议/);
  });
});

