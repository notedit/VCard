import { describe, expect, it } from 'vitest';
import { buildPlanInstructions } from '../src/agent/plan-agent.js';
import type { SkillRow } from '../src/db/schema.js';

function skill(overrides: Partial<SkillRow> & Pick<SkillRow, 'id' | 'name' | 'systemPrompt'>): SkillRow {
  return {
    author: 'VCard',
    category: [],
    fewShotExamples: [],
    imageRefs: [],
    outputSchema: {},
    appliesTo: { platforms: ['redbook'], stages: ['plan'] },
    isOfficial: true,
    ...overrides,
  } as SkillRow;
}

describe('buildPlanInstructions — MVP-4 skill stacking', () => {
  it('uses defaults when no skills are passed', () => {
    const out = buildPlanInstructions([]);
    expect(out).toContain('正文 ≤ 80 字'); // default
    expect(out).not.toContain('已挂载 Skills');
  });

  it('appends skill systemPrompt blocks in priority order', () => {
    const a = skill({ id: '1', name: '爆款标题手', systemPrompt: 'A_PROMPT_BODY' });
    const b = skill({ id: '2', name: '小红书种草体', systemPrompt: 'B_PROMPT_BODY' });
    const out = buildPlanInstructions([a, b]);
    expect(out).toContain('# 已挂载 Skills');
    expect(out).toContain('### Skill #1: 爆款标题手');
    expect(out).toContain('### Skill #2: 小红书种草体');
    // ordering: A appears before B
    expect(out.indexOf('A_PROMPT_BODY')).toBeLessThan(out.indexOf('B_PROMPT_BODY'));
  });

  it('skips skills whose appliesTo.stages does not include "plan"', () => {
    const planSkill = skill({ id: '1', name: 'Plan', systemPrompt: 'PLAN_BODY' });
    const imgOnly = skill({
      id: '2',
      name: 'Image Only',
      systemPrompt: 'IMG_BODY',
      appliesTo: { platforms: ['redbook'], stages: ['image_prompt'] },
    });
    const out = buildPlanInstructions([planSkill, imgOnly]);
    expect(out).toContain('PLAN_BODY');
    expect(out).not.toContain('IMG_BODY');
  });

  it('honors maxWordsPerCard from highest-priority skill that defines it', () => {
    const high = skill({
      id: '1',
      name: 'Tight',
      systemPrompt: 'X',
      outputSchema: { maxWordsPerCard: 42 },
    });
    const low = skill({
      id: '2',
      name: 'Loose',
      systemPrompt: 'Y',
      outputSchema: { maxWordsPerCard: 100 },
    });
    expect(buildPlanInstructions([high, low])).toContain('正文 ≤ 42 字');
    expect(buildPlanInstructions([low, high])).toContain('正文 ≤ 100 字'); // priority swap wins
  });

  it('falls back to default when no skill defines maxWordsPerCard', () => {
    const a = skill({ id: '1', name: 'X', systemPrompt: 'X' });
    expect(buildPlanInstructions([a])).toContain('正文 ≤ 80 字');
  });
});
