/** @jest-environment node */
import { execFileSync } from 'node:child_process';

import { PRIVATE_NO_STORE_SOURCES } from '../../lib/analytics/privatePaths';

/**
 * 결제·관리 화면이 Vercel 공유 캐시에 얹히면 다른 사람의 후원자 이름·연락처·배송지가
 * 그대로 보인다. next.config headers는 **첫 매칭이 우선**이라, no-store 규칙이 넓은 로케일
 * 캐시 규칙(`/:locale/:path*`)보다 뒤에 있으면 아무 효과가 없다 — 순서까지 함께 검사한다.
 *
 * jest는 .mjs를 CJS로 변환하는데 next.config.mjs가 스스로 __dirname을 선언해 충돌한다 —
 * 자식 node로 진짜 import해 값만 JSON으로 받아온다(fundingFileTracing.test.ts와 같은 방식).
 */
interface HeaderRule { source: string; headers: Array<{ key: string; value: string }> }

const loadHeaders = (): HeaderRule[] =>
  JSON.parse(
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', "import c from './next.config.mjs'; process.stdout.write(JSON.stringify(await c.headers()));"],
      { cwd: process.cwd(), encoding: 'utf-8' },
    ),
  );

const LOCALE = '/:locale(ko|en|zh|es|vi|th|uz)';
const PUBLIC_CACHE_SOURCE = `${LOCALE}/:path*`;

/**
 * 측정 제외 목록(lib/analytics/privatePaths.ts)에서 파생시킨다 — 두 목록이 갈라지면
 * "헤더는 막는데 측정은 새는" 조합이 조용히 생긴다(실제로 funding/fail이 그랬다).
 * pledge 폼만 no-store 전용 예외라 여기서 더한다(사유는 privatePaths.ts 주석).
 */
const PLEDGE_FORM_SOURCE = `${LOCALE}/funding/:slug/pledge`;
const PRIVATE_SOURCES = [...PRIVATE_NO_STORE_SOURCES, PLEDGE_FORM_SOURCE];

describe('next.config headers — 개인정보 경로 no-store', () => {
  const rules = loadHeaders();
  const indexOf = (source: string) => rules.findIndex((r) => r.source === source);

  it.each(PRIVATE_SOURCES)('%s 는 private, no-store 로 응답한다', (source) => {
    const rule = rules.find((r) => r.source === source);
    expect(rule).toBeDefined();
    const cacheControl = rule!.headers.find((h) => h.key === 'Cache-Control')?.value ?? '';
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('no-store');
  });

  it.each(PRIVATE_SOURCES)('%s 규칙은 공개 캐시 규칙보다 앞에 있다 (첫 매칭 우선)', (source) => {
    const publicIndex = indexOf(PUBLIC_CACHE_SOURCE);
    expect(publicIndex).toBeGreaterThanOrEqual(0);
    expect(indexOf(source)).toBeLessThan(publicIndex);
  });

  /**
   * 위 두 검사는 목록 → config 한 방향만 본다. config에만 no-store 규칙을 더하면 측정
   * 제외에서 조용히 빠진다 — funding/fail 사고와 정확히 같은 형태다. 그래서 반대 방향,
   * config의 no-store 규칙 집합이 목록과 **정확히 일치**하는지도 본다.
   */
  it('config의 no-store 규칙 집합은 목록과 정확히 일치한다 (config에만 추가되는 것도 잡는다)', () => {
    const noStoreInConfig = rules
      .filter((r) => r.headers.some((h) => h.key === 'Cache-Control' && h.value.includes('no-store')))
      .map((r) => r.source);
    expect([...noStoreInConfig].sort()).toEqual([...PRIVATE_SOURCES].sort());
  });

  // terms는 누구에게나 같은 공개 정적 페이지다 — no-store로 내리면 CDN 캐시만 버린다.
  it('/funding/terms는 no-store 대상이 아니다', () => {
    const sources = rules.map((r) => r.source).join('\n');
    expect(sources).not.toContain('terms');
  });
});
