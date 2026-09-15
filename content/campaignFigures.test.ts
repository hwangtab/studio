import fs from 'fs';
import path from 'path';

/**
 * 《남산타워》 캠페인의 실측 수치는 랜딩 카피(7 로케일) · llms.ts · 포트폴리오에
 * 흩어져 있고, 정본은 발송 원장(`~/music-promo/campaigns/namsan-tower/private/
 * send-log.jsonl`)이다. 저장소에 원장이 없으므로 여기 기대값을 박아 두고 대조한다.
 *
 * 2026-09-15 적대적 감사에서 실제로 어긋나 있었다:
 *   랜딩·llms   1,218곳 · 12일 · 8개 언어   (2026-09-09 기준값)
 *   포트폴리오  1,218곳 · 9개 언어
 *   원장 실측   1,270곳 · 13일 · 9개 언어   (2026-09-14, 09-14에 52곳 추가)
 *
 * 한 곳을 고치면 나머지가 따라오지 않는 것이 이 수치의 사고 형태다. 값을 갱신할
 * 때는 원장을 다시 세고 이 파일의 기대값부터 바꿀 것 — 그러면 빠뜨린 곳이 여기서
 * 드러난다.
 *
 * 언어 수는 원고 종수로 센다. 중국어 번체와 간체는 읽는 사람이 달라 별개 원고이고,
 * 스토리 본문도 "중국어 번체와 간체 … 아홉 가지"로 그렇게 적는다.
 *
 * 스토리 `mariko-yukie-namsan-tower-release.md`는 검사 대상이 아니다 — 발매 당시
 * 기록이라 1,218곳·열이틀을 기간과 함께 서술하고, 뒤이어 최종 1,270곳을 밝힌다.
 * 시점이 명시된 과거 서술은 낡은 값이 아니다.
 */

const NAMSAN = {
  outlets: 1270,
  staleOutlets: 1218,
  days: 13,
  staleDays: 12,
  languages: 9,
  staleLanguages: 8,
} as const;

const ROOT = path.join(__dirname, '..');
const LOCALES = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;

/** 1,270 · 1.270 · 1 270 · 1270 을 모두 같은 값으로 본다 (로케일별 자릿수 표기 차이). */
const digitsOnly = (s: string) => s.replace(/[,.  ](?=\d{3}\b)/g, '');

const localeCopy = (locale: string): string => {
  const file = path.join(ROOT, 'public', 'locales', locale, 'common.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return JSON.stringify(json.musicPromotion, null, 0);
};

describe('《남산타워》 실측 수치 정합', () => {
  describe.each(LOCALES)('%s 랜딩 카피', (locale) => {
    it('최신 발송처 수를 쓰고 낡은 값이 남아 있지 않다', () => {
      const flat = digitsOnly(localeCopy(locale));
      expect(flat).toContain(String(NAMSAN.outlets));
      expect(flat).not.toContain(String(NAMSAN.staleOutlets));
    });
  });

  it('ko 카피의 발송 일수와 언어 수가 원장과 같다', () => {
    const ko = localeCopy('ko');
    expect(ko).toContain(`${NAMSAN.days}일`);
    expect(ko).not.toContain(`${NAMSAN.staleDays}일`);
    expect(ko).toContain(`${NAMSAN.languages}개 언어`);
    expect(ko).not.toContain(`${NAMSAN.staleLanguages}개 언어`);
  });

  it('ko 카피가 수치의 기준 시점을 밝힌다', () => {
    // 집계는 계속 늘어난다. 기준일 없이 숫자만 두면 다음 발송에서 바로 낡는다.
    expect(localeCopy('ko')).toMatch(/2026년 9월 14일 기준/);
  });

  it.each([
    ['pages/api/llms.ts', 'llms.ts'],
    ['data/portfolio/items.ts', '포트폴리오'],
  ])('%s 의 캠페인 수치가 랜딩과 같다', (relPath) => {
    const source = digitsOnly(fs.readFileSync(path.join(ROOT, relPath), 'utf-8'));
    expect(source).toContain(String(NAMSAN.outlets));
    expect(source).not.toContain(String(NAMSAN.staleOutlets));
    expect(source).toContain(`${NAMSAN.languages}개 언어`);
    expect(source).not.toContain(`${NAMSAN.staleLanguages}개 언어`);
  });
});
