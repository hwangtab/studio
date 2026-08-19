/** @jest-environment node */

import { execFileSync } from 'child_process';
import path from 'path';

/**
 * 관측창(§3) 회귀 테스트.
 *
 * 2026-08-19에 이 절이 두 번 연속 오답을 냈다. 원인이 둘이었다.
 *  (1) `git log -1`로 마지막 커밋 하나만 봐서, 같은 날 등재된 다른 커밋이 통째로
 *      누락됐다(8/14에 1e26671388·8edb2dfbf1 두 건이 있었는데 뒤엣것만 보고).
 *  (2) 출발 슬러그만 출력하고 **승자(목적지)**를 안 보여줬다. 정작 수정하면 안 되는
 *      페이지는 승자인데, 사람이 리다이렉트 맵을 열어 직접 매핑해야 알 수 있었다.
 *
 * 과거 커밋 이력은 변하지 않으므로 실제 저장소 히스토리에 --today를 고정해 검증한다.
 */

const SCRIPT = path.join(process.cwd(), 'scripts/seo-preflight.mjs');

const runAt = (today: string): string =>
  execFileSync('node', [SCRIPT, '--today', today], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

const observationSection = (out: string): string => {
  const start = out.indexOf('── 3. 관측창');
  const end = out.indexOf('── 4.', start);
  return out.slice(start, end === -1 ? undefined : end);
};

describe('seo-preflight 관측창 — 같은 날 여러 커밋', () => {
  it('8/14에 등재된 두 커밋을 모두 보고한다 (예전엔 마지막 하나만 봤다)', () => {
    const s = observationSection(runAt('2026-08-19'));
    expect(s).toContain('1e26671388');
    expect(s).toContain('8edb2dfbf1');
  });

  it('출발이 아니라 승자 페이지를 수정 금지 대상으로 명시한다', () => {
    const s = observationSection(runAt('2026-08-19'));
    // 이 두 건이 실제로 놓쳤던 승자다.
    expect(s).toContain('songstructure1');
    expect(s).toContain('voice-actor-hiring-quote-cost');
    expect(s).toContain('수정 금지');
    // 출발 → 승자 매핑이 사람에게 보여야 한다.
    expect(s).toContain('pre-chorus1');
    expect(s).toContain('voice-acting-rate1');
  });
});

describe('seo-preflight 관측창 — 창 경계', () => {
  it('등재 당일에는 28일이 남은 것으로 센다', () => {
    expect(observationSection(runAt('2026-08-14'))).toContain('28일 남음');
  });

  it('git이 맨 날짜를 실행 시각으로 해석하는 문제에 걸리지 않는다', () => {
    // `--since=2026-08-14`는 그날 15:55 커밋도 제외한다(approxidate가 현재 시각을
    // 기본값으로 쓰기 때문). 자정을 명시하지 않으면 같은 스크립트가 아침·저녁에
    // 서로 다른 창을 잡는다. 28일째에도 해당 커밋이 조회돼야 한다.
    const s = observationSection(runAt('2026-09-11'));
    expect(s).toContain('1e26671388');
    expect(s).toContain('창 종료');
    expect(s).toContain('판정해도 된다');
  });

  it('창이 완전히 지나면 등재를 다시 경고하지 않는다', () => {
    const s = observationSection(runAt('2026-09-20'));
    expect(s).toContain('관측창 종료');
    expect(s).not.toContain('수정 금지');
  });
});
