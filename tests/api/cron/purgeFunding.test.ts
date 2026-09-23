/** @jest-environment node */

/**
 * 한 크론이 기준이 다른 두 파기를 나란히 돌린다.
 *
 * - 후원 배송지·응원 메시지: 리워드 전달 후 1년(법정 보존 5년 우선) — 약관 제13조·처리방침 8항
 * - 고유식별정보 접속기록: 2년 — 「개인정보의 안전성 확보조치 기준」 제8조①
 *
 * 두 기준이 한 함수로 합쳐지면 접속기록이 법정 하한 전에 지워진다. 이 테스트는 호출이
 * **둘로 갈려 있다**는 사실을 고정한다.
 */
jest.mock('../../../lib/cron/auth', () => ({ isCronAuthorized: jest.fn() }));
jest.mock('../../../lib/funding/retention', () => ({
  purgeExpiredFundingPersonalData: jest.fn(),
  REWARD_RETENTION_YEARS: 1,
}));
jest.mock('../../../lib/privacy/accessLog', () => ({
  purgeExpiredPrivacyAccessLogs: jest.fn(),
  PRIVACY_ACCESS_LOG_RETENTION_YEARS: 2,
}));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/cron/purge-funding';
import { isCronAuthorized } from '../../../lib/cron/auth';
import { purgeExpiredFundingPersonalData } from '../../../lib/funding/retention';
import { purgeExpiredPrivacyAccessLogs } from '../../../lib/privacy/accessLog';
import { sendEmail } from '../../../lib/email/resend';

const call = async () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', headers: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as Record<string, unknown> };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (isCronAuthorized as jest.Mock).mockReturnValue(true);
  (purgeExpiredFundingPersonalData as jest.Mock).mockResolvedValue({ purged: 3 });
  (purgeExpiredPrivacyAccessLogs as jest.Mock).mockResolvedValue({ purged: 7 });
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 아무것도 지우지 않는다', async () => {
  (isCronAuthorized as jest.Mock).mockReturnValue(false);
  expect((await call()).status).toBe(401);
  expect(purgeExpiredFundingPersonalData).not.toHaveBeenCalled();
  expect(purgeExpiredPrivacyAccessLogs).not.toHaveBeenCalled();
});

it('두 파기를 각각 돌리고 건수를 따로 돌려준다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, purged: 3, purgedAccessLogs: 7 });
  expect(purgeExpiredFundingPersonalData).toHaveBeenCalledTimes(1);
  expect(purgeExpiredPrivacyAccessLogs).toHaveBeenCalledTimes(1);
});

it('접속기록 삭제가 실패하면 500이고 운영자에게 메일이 간다', async () => {
  (purgeExpiredPrivacyAccessLogs as jest.Mock).mockRejectedValue(new Error('DB 장애'));
  const r = await call();
  expect(r.status).toBe(500);
  expect(sendEmail).toHaveBeenCalledTimes(1);
});
