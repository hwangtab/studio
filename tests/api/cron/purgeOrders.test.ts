/** @jest-environment node */

/**
 * 한 크론이 기준이 다른 열세 가지 파기를 나란히 돌린다.
 *
 * - 주문 고객 이름·연락처: 전자상거래법 5년(생성일·최종 갱신일 둘 다 기준)
 * - 결제 실패 사유 원문: 실패 시각부터 1년(법정 보존이 아니라 운영 판단)
 * - 회차 결제 실패 사유 원문: 시도 시각부터 1년(같은 값의 같은 성질이라 같은 기준)
 * - 방치된 구독: 마지막 활동 3년 뒤 `ended`로 전이(결제 이력이 없으면 그 자리에서 고객 정보 파기)
 * - 구독 고객 이름·연락처: **종료(`ended`)** 후 5년
 * - 후원자 표시 이름: 종료 즉시(공개 명단에서 빠지는 순간 목적이 끝난다)
 * - 구독 해지 사유: 해지 시각부터 3년(소비자 불만·분쟁 처리 기록)
 * - 결제 승인 응답 원본: 승인 후 5년(대금결제 기록의 근거)
 * - 빌링키 발급 응답 원본: 키를 못 쓰게 된 즉시(폐기됐거나 구독이 끝났을 때)
 * - 환불 사유: 환불 후 5년(청약철회 기록의 내용)
 * - 예약·믹싱 요청사항: 이용·납품 후 3년(법정 기록이 아니다)
 * - 일정 차단 메모: 그 시간대가 끝난 뒤 1년(운영 판단)
 *
 * 기준이 한 함수로 합쳐지면 법정 보존 대상이 먼저 지워지거나 자유기재 메모가 5년을 더
 * 남는다. 이 테스트는 호출이 **갈려 있고 서로의 실패에 걸리지 않는다**는 사실을
 * 고정한다(purge-funding과 같은 구조·같은 이유).
 */
jest.mock('../../../lib/cron/auth', () => ({ isCronAuthorized: jest.fn() }));
jest.mock('../../../lib/privacy/orderRetention', () => ({
  closeDormantSubscriptions: jest.fn(),
  purgeExpiredOrderCustomerData: jest.fn(),
  purgeExpiredPaymentFailMessages: jest.fn(),
  purgeExpiredSubscriptionCustomerData: jest.fn(),
  purgeEndedSubscriptionDisplayNames: jest.fn(),
  purgeExpiredSubscriptionCancelReasons: jest.fn(),
  purgeExpiredPaymentRawResponses: jest.fn(),
  purgeUnusableBillingKeyRawResponses: jest.fn(),
  purgeExpiredRefundReasons: jest.fn(),
  purgeExpiredBookingCustomerNotes: jest.fn(),
  purgeExpiredWorkOrderCustomerNotes: jest.fn(),
  purgeExpiredAvailabilityBlockMemos: jest.fn(),
  purgeExpiredSubscriptionPaymentMessages: jest.fn(),
  ORDER_LEGAL_RETENTION_YEARS: 5,
  DISPUTE_RETENTION_YEARS: 3,
  PAYMENT_FAIL_MESSAGE_RETENTION_YEARS: 1,
  AVAILABILITY_MEMO_RETENTION_YEARS: 1,
  SUBSCRIPTION_DORMANCY_YEARS: 3,
}));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/cron/purge-orders';
import { isCronAuthorized } from '../../../lib/cron/auth';
import {
  closeDormantSubscriptions,
  purgeEndedSubscriptionDisplayNames,
  purgeExpiredAvailabilityBlockMemos,
  purgeExpiredBookingCustomerNotes,
  purgeExpiredOrderCustomerData,
  purgeExpiredPaymentFailMessages,
  purgeExpiredPaymentRawResponses,
  purgeExpiredRefundReasons,
  purgeExpiredSubscriptionCancelReasons,
  purgeExpiredSubscriptionCustomerData,
  purgeExpiredSubscriptionPaymentMessages,
  purgeExpiredWorkOrderCustomerNotes,
  purgeUnusableBillingKeyRawResponses,
} from '../../../lib/privacy/orderRetention';
import { sendEmail } from '../../../lib/email/resend';

const all = [
  closeDormantSubscriptions,
  purgeExpiredOrderCustomerData,
  purgeExpiredPaymentFailMessages,
  purgeExpiredSubscriptionCustomerData,
  purgeEndedSubscriptionDisplayNames,
  purgeExpiredSubscriptionCancelReasons,
  purgeExpiredPaymentRawResponses,
  purgeUnusableBillingKeyRawResponses,
  purgeExpiredRefundReasons,
  purgeExpiredBookingCustomerNotes,
  purgeExpiredWorkOrderCustomerNotes,
  purgeExpiredAvailabilityBlockMemos,
  purgeExpiredSubscriptionPaymentMessages,
] as unknown as jest.Mock[];

const call = async () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', headers: {} } as unknown as NextApiRequest, res);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as Record<string, unknown>,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (isCronAuthorized as jest.Mock).mockReturnValue(true);
  (closeDormantSubscriptions as jest.Mock).mockResolvedValue({ purged: 13, ended: 14 });
  (purgeExpiredOrderCustomerData as jest.Mock).mockResolvedValue({ purged: 3 });
  (purgeExpiredPaymentFailMessages as jest.Mock).mockResolvedValue({ purged: 5 });
  (purgeExpiredSubscriptionCustomerData as jest.Mock).mockResolvedValue({ purged: 2 });
  (purgeEndedSubscriptionDisplayNames as jest.Mock).mockResolvedValue({ purged: 1 });
  (purgeExpiredSubscriptionCancelReasons as jest.Mock).mockResolvedValue({ purged: 4 });
  (purgeExpiredPaymentRawResponses as jest.Mock).mockResolvedValue({ purged: 6 });
  (purgeUnusableBillingKeyRawResponses as jest.Mock).mockResolvedValue({ purged: 7 });
  (purgeExpiredRefundReasons as jest.Mock).mockResolvedValue({ purged: 8 });
  (purgeExpiredBookingCustomerNotes as jest.Mock).mockResolvedValue({ purged: 9 });
  (purgeExpiredWorkOrderCustomerNotes as jest.Mock).mockResolvedValue({ purged: 10 });
  (purgeExpiredAvailabilityBlockMemos as jest.Mock).mockResolvedValue({ purged: 11 });
  (purgeExpiredSubscriptionPaymentMessages as jest.Mock).mockResolvedValue({ purged: 12 });
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 아무것도 지우지 않는다', async () => {
  (isCronAuthorized as jest.Mock).mockReturnValue(false);
  expect((await call()).status).toBe(401);
  for (const fn of all) expect(fn).not.toHaveBeenCalled();
});

it('열세 파기를 각각 돌리고 건수를 따로 돌려준다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({
    ok: true,
    purgedOrderCustomers: 3,
    purgedPaymentFailMessages: 5,
    endedDormantSubscriptions: 14,
    purgedDormantSubscriptionCustomers: 13,
    purgedSubscriptionCustomers: 2,
    purgedSubscriptionDisplayNames: 1,
    purgedSubscriptionCancelReasons: 4,
    purgedPaymentRawResponses: 6,
    purgedBillingKeyRawResponses: 7,
    purgedRefundReasons: 8,
    purgedBookingCustomerNotes: 9,
    purgedWorkOrderCustomerNotes: 10,
    purgedAvailabilityBlockMemos: 11,
    purgedSubscriptionPaymentMessages: 12,
  });
  for (const fn of all) expect(fn).toHaveBeenCalledTimes(1);
});

it('한 파기가 실패해도 나머지는 그대로 돈다', async () => {
  (purgeExpiredOrderCustomerData as jest.Mock).mockRejectedValue(new Error('no such column'));
  const r = await call();
  expect(r.status).toBe(500);
  for (const fn of all.filter((f) => f !== purgeExpiredOrderCustomerData)) {
    expect(fn).toHaveBeenCalledTimes(1);
  }
  // 성공한 것은 건수를, 실패한 것은 null을 싣는다 — "0건 파기"와 "돌지 못함"은 다른 상태다.
  expect(r.body).toMatchObject({
    ok: false,
    purgedOrderCustomers: null,
    purgedPaymentFailMessages: 5,
    purgedSubscriptionCustomers: 2,
    purgedRefundReasons: 8,
    purgedBookingCustomerNotes: 9,
  });
});

it('법정 보존 기록의 파기가 실패해도 자유기재 메모 파기는 그대로 돈다', async () => {
  (purgeExpiredRefundReasons as jest.Mock).mockRejectedValue(new Error('no such table: refunds'));
  const r = await call();
  expect(r.status).toBe(500);
  expect(purgeExpiredBookingCustomerNotes).toHaveBeenCalledTimes(1);
  expect(purgeExpiredAvailabilityBlockMemos).toHaveBeenCalledTimes(1);
  expect(r.body).toMatchObject({ purgedRefundReasons: null, purgedAvailabilityBlockMemos: 11 });
});

it('실패 메일은 어느 파기가 왜 실패했는지 적는다', async () => {
  (purgeExpiredSubscriptionCustomerData as jest.Mock).mockRejectedValue(new Error('DB 장애'));
  (purgeExpiredSubscriptionCancelReasons as jest.Mock).mockRejectedValue(new Error('no such column: cancel_reason'));
  await call();
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const mail = (sendEmail as jest.Mock).mock.calls[0][0] as { subject: string; text: string };
  expect(mail.subject).toContain('2건');
  expect(mail.text).toContain('구독 종료 후 5년');
  expect(mail.text).toContain('DB 장애');
  expect(mail.text).toContain('해지 후 3년');
  expect(mail.text).toContain('no such column: cancel_reason');
});

/**
 * 방치 종료가 **구독 파기들보다 먼저** 돌아야 한다. 그 호출이 `ended`로 넘긴 행을 같은
 * 회차의 표시 이름·해지 사유·고객 정보 파기가 받아 가기 때문이다 — 순서가 뒤집히면
 * 방치 구독의 파기가 매달 한 달씩 밀린다.
 */
it('방치 종료가 구독 파기들보다 먼저 돈다', async () => {
  await call();
  const order = (fn: unknown) => (fn as jest.Mock).mock.invocationCallOrder[0];
  expect(order(closeDormantSubscriptions)).toBeLessThan(order(purgeExpiredSubscriptionCustomerData));
  expect(order(closeDormantSubscriptions)).toBeLessThan(order(purgeEndedSubscriptionDisplayNames));
  expect(order(closeDormantSubscriptions)).toBeLessThan(order(purgeExpiredSubscriptionCancelReasons));
  expect(order(closeDormantSubscriptions)).toBeLessThan(order(purgeUnusableBillingKeyRawResponses));
});

it('방치 종료가 실패해도 나머지 파기는 그대로 돈다', async () => {
  (closeDormantSubscriptions as jest.Mock).mockRejectedValue(new Error('no such column: status'));
  const r = await call();
  expect(r.status).toBe(500);
  expect(r.body).toMatchObject({
    endedDormantSubscriptions: null,
    purgedDormantSubscriptionCustomers: null,
    purgedSubscriptionCustomers: 2,
  });
});
