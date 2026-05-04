import { describe, expect, it } from 'vitest';
import { buildEditInstructions } from '../src/agent/edit-agent.js';
import type { CardRow, SkillRow } from '../src/db/schema.js';

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000fff',
    index: 2,
    role: 'argument',
    title: '原标题',
    body: '原正文',
    imageVersionId: null,
    userEdited: false,
    locked: false,
    version: 1,
    ...overrides,
  } as CardRow;
}

function skill(
  overrides: Partial<SkillRow> & Pick<SkillRow, 'id' | 'name' | 'systemPrompt'>,
): SkillRow {
  return {
    author: 'VCard',
    category: [],
    fewShotExamples: [],
    imageRefs: [],
    outputSchema: {},
    appliesTo: { platforms: ['redbook'], stages: ['edit'] },
    isOfficial: true,
    ...overrides,
  } as SkillRow;
}

describe('buildEditInstructions — Skill stacking + Voice & Tone', () => {
  const baseArgs = {
    model: {} as never, // not invoked by buildEditInstructions
    card: card(),
    contextCards: [],
    field: 'body' as const,
  };

  it('uses defaults when no skills passed', () => {
    const out = buildEditInstructions(baseArgs);
    expect(out).toContain('正文 ≤ 80 字'); // default
    expect(out).toContain('Voice & Tone');
    expect(out).not.toContain('已挂载 Skills');
  });

  it('reads maxWordsPerCard from highest-priority edit-stage skill', () => {
    const high = skill({
      id: '1',
      name: 'Tight',
      systemPrompt: 'X',
      outputSchema: { maxWordsPerCard: 30 },
    });
    const low = skill({
      id: '2',
      name: 'Loose',
      systemPrompt: 'Y',
      outputSchema: { maxWordsPerCard: 100 },
    });
    expect(buildEditInstructions({ ...baseArgs, skills: [high, low] })).toContain('正文 ≤ 30 字');
    expect(buildEditInstructions({ ...baseArgs, skills: [low, high] })).toContain('正文 ≤ 100 字');
  });

  it('skips skills whose appliesTo.stages does not include "edit"', () => {
    const planOnly = skill({
      id: '1',
      name: 'Plan Only',
      systemPrompt: 'PLAN_BODY',
      appliesTo: { platforms: ['redbook'], stages: ['plan'] },
    });
    const out = buildEditInstructions({ ...baseArgs, skills: [planOnly] });
    expect(out).not.toContain('PLAN_BODY');
    expect(out).not.toContain('已挂载 Skills');
  });

  it('injects fewShotExamples for edit-stage skills', () => {
    const s = skill({
      id: '1',
      name: 'Sample',
      systemPrompt: 'PROMPT',
      fewShotExamples: [{ input: '原句', output: '改后' }],
    });
    const out = buildEditInstructions({ ...baseArgs, skills: [s] });
    expect(out).toContain('Few-shot 示例');
    expect(out).toContain('Input: 原句');
    expect(out).toContain('Output: 改后');
  });

  it('emits neighbor context only when contextCards is non-empty', () => {
    const withNeighbor = buildEditInstructions({
      ...baseArgs,
      contextCards: [{ index: 1, role: 'hook', title: 't1', body: 'b1' }],
    });
    expect(withNeighbor).toContain('邻近卡片');
    expect(withNeighbor).toContain('「t1」');

    const withoutNeighbor = buildEditInstructions({ ...baseArgs, contextCards: [] });
    expect(withoutNeighbor).not.toContain('邻近卡片');
  });
});
