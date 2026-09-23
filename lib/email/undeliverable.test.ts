/** @jest-environment node */

import { PURGED_MARK } from '../privacy/orderRetention';
import { isUndeliverableAddress } from './resend';

/**
 * 시험용 주소로 보내면 그대로 반송되고, 반송이 쌓이면 발신 도메인 평판이 깎인다.
 * 그 대가는 진짜 고객의 메일이 스팸함으로 가는 형태로 돌아온다.
 */
describe('배달 불가 주소 차단', () => {
  it.each([
    'test@example.com',
    'a@example.net',
    'b@example.org',
    'c@test',
    'd@invalid',
    'e@localhost',
    'FOO@EXAMPLE.COM',
    '  spaced@example.com  ',
  ])('%s 를 배달 불가로 본다', (address) => {
    expect(isUndeliverableAddress(address)).toBe(true);
  });

  it.each([
    'hello@studionol.co.kr',
    'user@naver.com',
    'someone@studionol.co.kr',
    'a@example.co.kr',
    'b@myexample.com',
    'c@test.co.kr',
  ])('%s 는 정상 주소로 본다', (address) => {
    expect(isUndeliverableAddress(address)).toBe(false);
  });

  /**
   * 보관 기간이 지난 주문·구독은 이메일 칸이 표식으로 덮인다. 그대로 Resend에 넘기면 422가
   * 나고, 그 실패가 orders.notificationError에 박혀 헬스체크의 일일 경보가 안 꺼진다.
   */
  it('파기 표식은 주소가 아니다', () => {
    expect(isUndeliverableAddress(PURGED_MARK)).toBe(true);
    expect(isUndeliverableAddress(`  ${PURGED_MARK}  `)).toBe(true);
  });
});
