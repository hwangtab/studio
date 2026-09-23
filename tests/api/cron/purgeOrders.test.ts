/** @jest-environment node */

/**
 * 한 크론이 기준이 다른 다섯 파기를 나란히 돌린다.
 *
 * - 주문 고객 이름·연락처: 전자상거래법 5년(생성일·최종 갱신일 둘 다 기준)
 * - 결제 실패 사유 원문: 실패 시각부터 1년(법정 보존이 아니라 운영 판단)
 * - 구독 고객 이름·연락처: **종료(`ended`)** 후 5년
 * - 후원자 표시 이름: 종료 즉시(공개 명단에서 빠지는 순간 목적이 끝난다)
 * - 구독 해지 사유: 해지 시각부터 3년(소비자 불만·분쟁 처리 기록)
 *
 * 기준이 한 함수로 합쳐지면 법정 보존 대상이 먼저 지워지거나 자유기재 메모가 5년을 더
 * 남는다. 이 테스트는 호출이 **다섯으로 갈려 있고 서로의 실패에 걸리지 않는다**는 사실을
 * 고정한다(purge-funding과 같은 구조·같은 이유).
 */
jest.mock('../../../lib/cron/auth', () => ({ isCronAuthorized: jest.fn() }));
jest.mock('../../../lib/privacy/orderRetention', () => ({
  purgeExpiredOrderCustomerData: jest.fn(),
  purgeExpiredPaymentFailMessages: jest.fn(),
  purgeExpiredSubscriptionCustomerData: jest.fn(),
  purgeEndedSubscriptionDisplayNames: jest.fn(),
  purgeExpiredSubscriptionCancelReasons: jest.fn(),
  ORDER_LEGAL_RETENTION_YEARS: 5,
  DISPUTE_RETENTION_YEARS: 3,
  PAYMENT_FAIL_MESSAGE_RETENTION_YEARS: 1,
}));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/cron/purge-orders';
import { isCronAuthorized } from '../../../lib/cron/auth';
import {
  purgeEndedSubscriptionDisplayNames,
  purgeExpiredOrderCustomerData,
  purgeExpiredPaymentFailMessages,
  purgeExpiredSubscriptionCancelReasons,
  purgeExpiredSubscriptionCustomerData,
} from '../../../lib/privacy/orderRetention';
import { sendEmail } from '../../../lib/email/resend';

const all = [
  purgeExpiredOrderCustomerData,
  purgeExpiredPaymentFailMessages,
  purgeExpiredSubscriptionCustomerData,
  purgeEndedSubscriptionDisplayNames,
  purgeExpiredSubscriptionCancelReasons,
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
  (purgeExpiredOrderCustomerData as jest.Mock).mockResolvedValue({ purged: 3 });
  (purgeExpiredPaymentFailMessages as jest.Mock).mockResolvedValue({ purged: 5 });
  (purgeExpiredSubscriptionCustomerData as jest.Mock).mockResolvedValue({ purged: 2 });
  (purgeEndedSubscriptionDisplayNames as jest.Mock).mockResolvedValue({ purged: 1 });
  (purgeExpiredSubscriptionCancelReasons as jest.Mock).mockResolvedValue({ purged: 4 });
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 아무것도 지우지 않는다', async () => {
  (isCronAuthorized as jest.Mock).mockReturnValue(false);
  expect((await call()).status).toBe(401);
  for (const fn of all) expect(fn).not.toHaveBeenCalled();
});

it('다섯 파기를 각각 돌리고 건수를 따로 돌려준다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({
    ok: true,
    purgedOrderCustomers: 3,
    purgedPaymentFailMessages: 5,
    purgedSubscriptionCustomers: 2,
    purgedSubscriptionDisplayNames: 1,
    purgedSubscriptionCancelReasons: 4,
  });
  for (const fn of all) expect(fn).toHaveBeenCalledTimes(1);
});

it('한 파기가 실패해도 나머지 넷은 그대로 돈다', async () => {
  (purgeExpiredOrderCustomerData as jest.Mock).mockRejectedValue(new Error('no such column'));
  const r = await call();
  expect(r.status).toBe(500);
  for (const fn of all.slice(1)) expect(fn).toHaveBeenCalledTimes(1);
  // 성공한 것은 건수를, 실패한 것은 null을 싣는다 — "0건 파기"와 "돌지 못함"은 다른 상태다.
  expect(r.body).toMatchObject({
    ok: false,
    purgedOrderCustomers: null,
    purgedPaymentFailMessages: 5,
    purgedSubscriptionCustomers: 2,
  });
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
