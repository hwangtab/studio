/** @jest-environment node */

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
});
