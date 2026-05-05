/**
 * Opt-in real-API smoke test for AIHubMix Anthropic-compatible routing.
 *
 * It bypasses AI SDK and ToolLoopAgent on purpose: the goal is to prove the
 * gateway URL + headers + minimal body are valid before debugging app logic.
 *
 * Enable explicitly:
 *   RUN_REAL_AIHUBMIX_TEST=1 npm test --workspace @vcard/api -- --run test/aihubmix-anthropic.real.test.ts
 */
import { describe, expect, it } from 'vitest';
import { AIHUBMIX_ANTHROPIC_BASE_URL } from '../src/agent/model-config.js';
import { EDIT_MODEL_ID } from '../src/agent/edit-agent.js';

const RUN_REAL = process.env.RUN_REAL_AIHUBMIX_TEST === '1';
const describeIfReal = RUN_REAL ? describe : describe.skip;

describeIfReal('AIHubMix Anthropic-compatible endpoint (opt-in real smoke)', () => {
  it('POST /v1/messages returns an Anthropic message JSON object', async () => {
    const apiKey = process.env.AIHUBMIX_API_KEY;
    if (!apiKey) throw new Error('AIHUBMIX_API_KEY missing');

    const res = await fetch(`${AIHUBMIX_ANTHROPIC_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: EDIT_MODEL_ID,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      }),
    });

    const text = await res.text();
    expect(res.status, text).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('application/json');

    const body = JSON.parse(text) as { type?: string; content?: Array<{ type?: string; text?: string }> };
    expect(body.type).toBe('message');
    expect(body.content?.some((part) => part.type === 'text')).toBe(true);
  });
});
