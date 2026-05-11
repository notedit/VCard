import { describe, expect, it } from 'vitest';
import { generateChatReply } from '../src/llm/chat.js';

const baseSettings = {
  template: '极简专业',
  theme: 'mono',
  density: 'standard' as const,
  layout: '自动匹配',
  imageStyle: 'editorial',
};

function fakeModel(text: string, captured?: { messages: unknown }) {
  // Mocked LanguageModel implementing the v3 doGenerate signature used by `ai` SDK.
  return {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doGenerate(opts: { prompt?: unknown }) {
      if (captured) captured.messages = opts.prompt;
      return {
        content: [{ type: 'text', text }],
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        warnings: [],
      };
    },
    async doStream() {
      throw new Error('not implemented');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('generateChatReply', () => {
  it('parses a JSON reply with body, actions and patches', async () => {
    const model = fakeModel(
      JSON.stringify({
        body: '把第一条要点拆成"判断 + 数据"两段。',
        actions: [
          { label: '更精炼标题', kind: 'title', patch: { title: 'Codex 概览' } },
          { label: '加数据点', kind: 'bullet', patch: { bullets: ['a', '8 月 7 日发布，7 亿周活'] } },
        ],
      }),
    );
    const reply = await generateChatReply({
      model,
      message: '帮我把封面改得更克制',
      card: { index: 0, total: 5, title: 'Codex', bullets: ['a'], layout: 'cover' },
      deckTitle: 't',
      deckPrompt: 'p',
      settings: baseSettings,
      env: {},
    });
    expect(reply.body).toContain('判断');
    expect(reply.actions).toHaveLength(2);
    expect(reply.actions[0].patch.title).toBe('Codex 概览');
    expect(reply.actions[1].patch.bullets).toEqual(['a', '8 月 7 日发布，7 亿周活']);
  });

  it('strips fences before parsing', async () => {
    const model = fakeModel(
      '好的，我会这样处理：\n```json\n' +
        JSON.stringify({
          body: '锁定整套，先把 closer 收紧。',
          actions: [{ label: '换开场', kind: 'tone', patch: { title: '一句话总结' } }],
        }) +
        '\n```',
    );
    const reply = await generateChatReply({
      model,
      message: '换个开场',
      card: null,
      deckTitle: 't',
      deckPrompt: 'p',
      settings: baseSettings,
      env: {},
    });
    expect(reply.body).toContain('收紧');
    expect(reply.actions[0].kind).toBe('tone');
    expect(reply.actions[0].patch.title).toBe('一句话总结');
  });

  it('rejects invalid action kinds via zod', async () => {
    const model = fakeModel(
      JSON.stringify({
        body: 'x',
        actions: [{ label: 'x', kind: 'rewrite', patch: { title: 'a' } }],
      }),
    );
    await expect(
      generateChatReply({
        model,
        message: 'm',
        card: null,
        deckTitle: 't',
        deckPrompt: 'p',
        settings: baseSettings,
        env: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects empty actions array', async () => {
    const model = fakeModel(
      JSON.stringify({
        body: 'x',
        actions: [],
      }),
    );
    await expect(
      generateChatReply({
        model,
        message: 'm',
        card: null,
        deckTitle: 't',
        deckPrompt: 'p',
        settings: baseSettings,
        env: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects action without patch', async () => {
    const model = fakeModel(
      JSON.stringify({
        body: 'x',
        actions: [{ label: 'l', kind: 'title' }],
      }),
    );
    await expect(
      generateChatReply({
        model,
        message: 'm',
        card: null,
        deckTitle: 't',
        deckPrompt: 'p',
        settings: baseSettings,
        env: {},
      }),
    ).rejects.toThrow();
  });

  it('rejects empty patch (no title or bullets)', async () => {
    const model = fakeModel(
      JSON.stringify({
        body: 'x',
        actions: [{ label: 'l', kind: 'title', patch: {} }],
      }),
    );
    await expect(
      generateChatReply({
        model,
        message: 'm',
        card: null,
        deckTitle: 't',
        deckPrompt: 'p',
        settings: baseSettings,
        env: {},
      }),
    ).rejects.toThrow();
  });

  it('forwards conversation history into model messages', async () => {
    const captured: { messages: unknown } = { messages: undefined };
    const model = fakeModel(
      JSON.stringify({
        body: 'ok',
        actions: [{ label: 'l', kind: 'title', patch: { title: 'x' } }],
      }),
      captured,
    );
    await generateChatReply({
      model,
      message: '当前消息',
      history: [
        { role: 'user', body: '前一轮 user 说的话' },
        { role: 'assistant', body: '前一轮 ai 说的话' },
      ],
      card: null,
      deckTitle: 't',
      deckPrompt: 'p',
      settings: baseSettings,
      env: {},
    });
    const promptMessages = captured.messages as Array<{ role: string; content: unknown }>;
    expect(Array.isArray(promptMessages)).toBe(true);
    // ai SDK 把 system prompt 也拼进数组，所以会多一条 role=system；过滤后剩对话本体
    const conversation = promptMessages.filter((m) => m.role !== 'system');
    expect(conversation).toHaveLength(3);
    expect(conversation[0].role).toBe('user'); // 历史第一条
    expect(conversation[1].role).toBe('assistant'); // 历史第二条
    expect(conversation[2].role).toBe('user'); // 当前消息
  });
});
