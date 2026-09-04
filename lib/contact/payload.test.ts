/** @jest-environment node */

import { isTooFast, isHoneypotSubmission } from './payload';

/**
 * 봇 시간 트랩 회귀.
 *
 * 원래 구현은 클라이언트의 **절대 시각**을 받아 서버 `Date.now()`에서 뺐다. 두 시계가
 * 다른 기계라 방문자 PC가 몇 초만 빨라도 정상 제출이 봇으로 찍혔고, 호출부는 그 경우
 * 200 성공을 돌려주므로(봇에게 실패를 알리지 않는 설계) 문의가 화면상 "전송 완료"인 채로
 * 사라졌다 — 운영자는 문의가 있었다는 사실조차 몰랐다.
 *
 * 지금은 **경과 시간**을 받는다. 한 시계 안에서만 빼므로 스큐가 판정에 들어갈 수 없다.
 */
describe('isTooFast — 봇 시간 트랩', () => {
  it('3초 미만이면 봇으로 본다', () => {
    expect(isTooFast(0)).toBe(true);
    expect(isTooFast(2999)).toBe(true);
  });

  it('3초 이상이면 통과시킨다', () => {
    expect(isTooFast(3000)).toBe(false);
    expect(isTooFast(45_000)).toBe(false);
  });

  /**
   * 핵심 회귀: 값이 **경과 시간**이므로 기기 시계가 얼마나 어긋나 있든 판정이 같아야 한다.
   * 절대 시각을 쓰던 시절에는 시계가 빠른 기기의 정상 제출이 여기서 버려졌다.
   */
  it('기기 시계가 어긋나도 정상 제출을 버리지 않는다', () => {
    // 사용자는 실제로 30초 동안 폼을 채웠다. 그 사실은 기기 시계 오차와 무관하다.
    const actuallySpent = 30_000;
    expect(isTooFast(actuallySpent)).toBe(false);

    // 시계가 1분 빠르거나 느린 기기에서도 경과 시간 자체는 그대로다.
    for (const skew of [-600_000, -60_000, 60_000, 600_000]) {
      expect(isTooFast(actuallySpent)).toBe(false);
      // 스큐는 경과 시간 계산에 아예 개입하지 않는다(클라이언트가 한 시계로 뺀다).
      expect(Date.now() + skew - (Date.now() + skew - actuallySpent)).toBe(actuallySpent);
    }
  });

  it('값이 없거나 숫자가 아니면 판정하지 않는다 (통과)', () => {
    // 구버전 캐시 JS가 이 필드를 안 보낼 수 있다. 정상 사용자를 버리는 쪽으로 기울지
    // 않는다 — honeypot이 남아 있다.
    expect(isTooFast(undefined)).toBe(false);
    expect(isTooFast('3000')).toBe(false);
    expect(isTooFast(NaN)).toBe(false);
    expect(isTooFast(Infinity)).toBe(false);
  });

  it('음수는 통과시킨다 (조작·계산오류가 정상 사용자를 죽이지 않게)', () => {
    expect(isTooFast(-5000)).toBe(false);
  });
});

describe('isHoneypotSubmission', () => {
  it('숨은 필드가 채워져 있으면 봇', () => {
    expect(isHoneypotSubmission('ACME Corp')).toBe(true);
  });

  it('비어 있으면 사람', () => {
    expect(isHoneypotSubmission('')).toBe(false);
    expect(isHoneypotSubmission('   ')).toBe(false);
    expect(isHoneypotSubmission(undefined)).toBe(false);
  });
});
