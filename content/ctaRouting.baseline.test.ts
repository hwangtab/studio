/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import { computeRouting, diffRouting } from '../scripts/cta-routing-baseline';

/**
 * 라우팅 기준선 게이트 — 정책(storyCtaPolicy·storyAutoFallback)이나 frontmatter가 바뀌어
 * 어떤 글의 하단 CTA·가격 카드 판정이 달라지면 여기서 선다. 의도한 변경이면
 * `npx tsx scripts/cta-routing-baseline.ts --update` 후 같은 커밋에 이유를 적을 것.
 * 배경: docs/ctr-surgery-log.md 2026-09-03/04, CLAUDE.md "라우팅 기준선 게이트".
 */
describe('story routing baseline', () => {
  it('matches content/cta-routing.baseline.json', () => {
    const baselinePath = path.join(process.cwd(), 'content/cta-routing.baseline.json');
    const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).entries as ReturnType<typeof computeRouting>;
    const changed = diffRouting(base, computeRouting());
    const report = changed
      .slice(0, 20)
      .map((c) => `${c.slug}: ${c.from ? `${c.from.cta}/${c.from.price}` : '(없음)'} → ${c.to ? `${c.to.cta}/${c.to.price}` : '(없음)'}`)
      .join('\n');
    expect(
      changed.length === 0
        ? ''
        : `${changed.length}편의 라우팅 판정이 기준선과 다르다. 의도한 변경이면 --update 후 커밋에 이유를 남길 것.\n${report}`,
    ).toBe('');
  });
});
