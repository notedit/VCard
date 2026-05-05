import { describe, expect, it } from 'vitest';
import { AIHUBMIX_ANTHROPIC_BASE_URL } from '../src/agent/model-config.js';

describe('AIHubMix model routing', () => {
  it('uses the Anthropic-compatible prefix so SDK posts to /v1/messages', () => {
    expect(AIHUBMIX_ANTHROPIC_BASE_URL).toBe('https://aihubmix.com/v1');
  });
});
