/** @jest-environment node */

import fs from 'fs';
import path from 'path';

/**
 * 영업시간은 한 사이트에서 여러 스키마 노드가 각자 발행한다 — 값이 갈리면 구조화 데이터가
 * 자기모순이 된다.
 *
 * 2026-08 24시간 전환에서 실제로 그런 일이 있었다. 네 커밋(2c0c3085e1 → 814d24b40b →
 * 061a5cf9d0 → 96ce1779b7)이 영업시간을 좁혔다 되돌렸다 하며 llms.ts·ContactInfoCard까지
 * 챙겼는데, `pages/[locale]/studio-info.tsx`의 Service.hoursAvailable만 아무도 열지 않아
 * `opens: '10:00'`이 남았다. 그 결과 LocalBusiness는 00:00–23:59, Service는 10:00–23:59를
 * 동시에 발행했고, 화면 표시값(common.json contact.hours "24시간 영업")과도 어긋났다 —
 * 구글의 "구조화 데이터는 페이지에 보이는 내용을 반영해야 한다"를 정면으로 깬다.
 *
 * 소스를 정적으로 훑는 이유: studio-info의 스키마는 페이지 컴포넌트 안에 인라인이라
 * import해서 부를 수 없다. 발행 지점이 늘어나도 이 테스트가 자동으로 함께 본다.
 */

const ROOT = process.cwd();

/** 영업시간(opens/closes)을 발행하는 소스. 새 발행 지점이 생기면 여기 추가된다. */
const SOURCES = ['utils/schema/business.ts', 'pages/[locale]/studio-info.tsx'];

const readOpeningHours = (relPath: string): { opens: string[]; closes: string[] } => {
  const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  return {
    opens: [...text.matchAll(/opens:\s*'([^']+)'/g)].map((m) => m[1]),
    closes: [...text.matchAll(/closes:\s*'([^']+)'/g)].map((m) => m[1]),
  };
};

describe('영업시간 스키마 일관성', () => {
  it('영업시간을 발행하는 소스를 모두 찾았다 (누락 감지)', () => {
    // 발행 지점이 늘었는데 SOURCES에 없으면 이 테스트가 무의미해진다. 실제로 세 번째
    // 사본이 있었던 것이 이번 사고의 원인이므로, 저장소를 훑어 목록과 대조한다.
    const scanDirs = ['pages', 'lib', 'utils', 'data', 'components'];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          if (/opens:\s*'/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) found.push(rel);
        }
      }
    };
    scanDirs.forEach(walk);

    expect(found.sort()).toEqual([...SOURCES].sort());
  });

  it('모든 발행 지점이 같은 영업시간을 낸다', () => {
    const all = SOURCES.map((src) => ({ src, ...readOpeningHours(src) }));

    for (const entry of all) {
      expect(entry.opens.length).toBeGreaterThan(0);
      expect(entry.closes.length).toBeGreaterThan(0);
    }

    const uniqueOpens = new Set(all.flatMap((e) => e.opens));
    const uniqueCloses = new Set(all.flatMap((e) => e.closes));

    expect([...uniqueOpens]).toEqual(['00:00']);
    expect([...uniqueCloses]).toEqual(['23:59']);
  });

  /**
   * 화면에 보이는 값과 일치해야 한다. 24시간 운영을 그만두면 이 테스트가 먼저 실패해
   * 스키마·화면을 함께 고치도록 강제한다.
   */
  it('화면 표시값(common.json)도 24시간이라고 말한다', () => {
    const common = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'public/locales/ko/common.json'), 'utf8'),
    );
    const hours = common.contact?.hours ?? {};
    const labels = [hours.weekdaysTime, hours.satTime, hours.sunTime].filter(Boolean);

    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).toContain('24시간');
    }
  });
});
