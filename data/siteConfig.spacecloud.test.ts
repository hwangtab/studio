/** @jest-environment node */
import { thirdPartyListings, spacecloudReviews } from './siteConfig';

/**
 * 제3자 후기 주장의 신선도 가드.
 *
 * `pages/api/llms.ts`가 "스페이스클라우드에 후기 N건, 평점 X" 를 AI가 읽는 파일에 사실로
 * 적는다. 이 숫자는 사람이 리스팅을 열어 손으로 옮기는 값이라 **조용히 낡는다** —
 * 후기가 늘거나 리스팅이 내려가도 코드는 모른다.
 *
 * 2026-09-24에 실제로 겪은 것: 이 주장이 출처 이름만 달고 링크 없이 적혀 있어
 * 근거 없는 날조로 의심받았다(커밋 이력을 뒤져서야 사실임이 확인됐다). 링크를 붙여
 * 검증 가능하게 만들었으니, 이제 **그 링크가 가리키는 숫자가 맞는지**를 주기적으로
 * 다시 확인해야 한다. 이 테스트는 "확인한 지 오래됐다"를 CI에서 알린다.
 */
const MAX_AGE_DAYS = 180;

describe('스페이스클라우드 제3자 후기 주장', () => {
  it('리스팅 URL이 실제 공간 주소 형태다', () => {
    expect(thirdPartyListings.spacecloud).toMatch(/^https:\/\/www\.spacecloud\.kr\/space\/\d+$/);
  });

  it('후기 수는 양의 정수, 평점은 0~5 사이다', () => {
    expect(Number.isInteger(spacecloudReviews.count)).toBe(true);
    expect(spacecloudReviews.count).toBeGreaterThan(0);
    expect(spacecloudReviews.rating).toBeGreaterThan(0);
    expect(spacecloudReviews.rating).toBeLessThanOrEqual(5);
  });

  it('checkedOn은 YYYY-MM-DD이고 미래가 아니다', () => {
    expect(spacecloudReviews.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(`${spacecloudReviews.checkedOn}T00:00:00Z`);
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it(`checkedOn이 ${MAX_AGE_DAYS}일을 넘기면 실패한다 — 리스팅을 다시 열어 숫자를 확인하고 날짜를 갱신하라`, () => {
    const d = new Date(`${spacecloudReviews.checkedOn}T00:00:00Z`);
    const ageDays = (Date.now() - d.getTime()) / 86_400_000;
    expect(ageDays).toBeLessThanOrEqual(MAX_AGE_DAYS);
  });
});
