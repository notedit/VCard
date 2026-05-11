import { describe, expect, it } from 'vitest';
import { resolveTemplate } from '@vcard/shared-types';
import { LAYOUT_EYEBROW, eyebrowFor } from './eyebrow.js';

const spec = resolveTemplate('极简专业'); // eyebrowText = "vCard · 资讯"

describe('eyebrowFor', () => {
  it('cover 无视 layout，返回 templateSpec.eyebrowText', () => {
    expect(eyebrowFor({ layout: 'list' }, true, false, spec)).toBe(spec.eyebrowText);
    expect(eyebrowFor({ layout: 'stat' }, true, false, spec)).toBe(spec.eyebrowText);
  });

  it('closer 无视 layout，返回"结语"', () => {
    expect(eyebrowFor({ layout: 'list' }, false, true, spec)).toBe('结语');
    expect(eyebrowFor({ layout: 'quote' }, false, true, spec)).toBe('结语');
  });

  it('中间 list / quote / stat 各自走对应文案', () => {
    expect(eyebrowFor({ layout: 'list' }, false, false, spec)).toBe('要点');
    expect(eyebrowFor({ layout: 'quote' }, false, false, spec)).toBe('观点');
    expect(eyebrowFor({ layout: 'stat' }, false, false, spec)).toBe('数据');
  });

  it('layout 缺失时 fallback 到"要点"', () => {
    expect(eyebrowFor({}, false, false, spec)).toBe(LAYOUT_EYEBROW.list);
  });

  it('cover/closer 同时为 false 时受 layout 控制（即使 layout=cover 这种异常）', () => {
    // 实际位置约束在 outline 层强制，但 eyebrowFor 应该容错
    expect(eyebrowFor({ layout: 'cover' }, false, false, spec)).toBe('封面');
  });
});
