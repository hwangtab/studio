/**
 * 운영자 알림은 실제 받은편지함으로 바로 간다 — hello@(Resend 수신 → 웹훅 재발송)를 거치면
 * 답장 주소가 noreply@로 덮여 문의 폼 답장이 고객에게 가지 않았다(2026-10-03 감사).
 */
import { CUSTOMER_REPLY_TO, OPERATOR_EMAIL, OPERATOR_INBOX } from './operatorContact';

describe('운영자 주소', () => {
  it('운영자 알림은 hello@(수신 웹훅 주소)로 보내지 않는다', () => {
    expect(OPERATOR_EMAIL.toLowerCase()).not.toBe(CUSTOMER_REPLY_TO.toLowerCase());
  });

  it('알림 수신 주소와 웹훅 전달 대상은 같은 받은편지함이다', () => {
    expect(OPERATOR_EMAIL).toBe(OPERATOR_INBOX);
  });
});
