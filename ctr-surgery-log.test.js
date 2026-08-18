/** @jest-environment node */

// docs/ctr-surgery-log.md 실험 장부의 트립와이어.
//
// 2026-08-15~17 리뷰일이 도래한 실험 4건이 아무도 안 봐서 1~3일씩 밀린 채 방치됐다
// (seo-preflight를 돌려야만 보였다). 이 테스트는 리뷰일이 유예기간을 넘겨 지난 🔒 실험이
// 있으면 CI를 깨뜨려, 장부가 스스로 판정을 요구하게 만든다.
//
// 깨졌을 때 고치는 법:
//   node --env-file=.env.local scripts/ctr-verdict.mjs --from-log
//   → 판정 결과를 실험 현황표에 반영(🔒 → ✅/❌/➖/ⓘ)하고 커밋.

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'docs/ctr-surgery-log.md');
// 리뷰일 + 유예 7일까지는 통과. GSC 최종화 지연(3일)과 주말을 감안한 여유.
const GRACE_DAYS = 7;

const parseOpenExperiments = () => {
  const rows = fs.readFileSync(LOG_PATH, 'utf8').split('\n')
    .filter((line) => line.startsWith('| ') && line.includes('🔒'));
  return rows.map((row) => {
    const cells = row.split('|').map((c) => c.trim());
    return {
      slug: (cells[1] || '').replace(/\*\*/g, '').replace(/`/g, '').trim(),
      surgery: (cells[3] || '').match(/20\d{2}-\d{2}-\d{2}/)?.[0] ?? null,
      review: (cells[5] || '').match(/20\d{2}-\d{2}-\d{2}/)?.[0] ?? null,
    };
  });
};

describe('ctr-surgery-log 실험 장부', () => {
  const experiments = parseOpenExperiments();

  it('측정 중(🔒) 실험은 수술일·리뷰일이 파싱 가능해야 한다 (ctr-verdict --from-log가 이 형식에 의존)', () => {
    const broken = experiments
      .filter((e) => !e.slug || !e.surgery || !e.review)
      .map((e) => e.slug || '(slug 없음)');
    expect(broken).toEqual([]);
  });

  it(`리뷰일이 ${GRACE_DAYS}일 넘게 지난 실험은 판정해야 한다 (ctr-verdict --from-log 실행 후 표 갱신)`, () => {
    const now = Date.now();
    const overdue = experiments
      .filter((e) => e.review)
      .filter((e) => (now - new Date(`${e.review}T00:00:00Z`).getTime()) / 864e5 > GRACE_DAYS)
      .map((e) => `${e.slug} (리뷰일 ${e.review})`);
    expect(overdue).toEqual([]);
  });
});
