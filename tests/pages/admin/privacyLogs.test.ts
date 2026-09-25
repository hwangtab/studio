/** @jest-environment node */

/**
 * 접속기록 화면 — 기록만 쌓이고 읽을 길이 없으면 계정을 사람별로 나눈 효과를 확인할 수 없다.
 *
 * 여기서 고정하는 것 둘: 필터가 실제로 질의에 걸리는가, 그리고 **이 화면을 연 것 자체는
 * 기록되지 않는가**(기록되면 기록을 보려고 연 화면이 다시 기록을 낳아 무한히 자기를 부른다).
 */

jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
jest.mock('../../../lib/privacy/accessLogQuery', () => {
  const actual = jest.requireActual('../../../lib/privacy/accessLogQuery');
  return { ...actual, listPrivacyAccessLogs: jest.fn(), listPrivacyAccessActors: jest.fn() };
});
jest.mock('../../../lib/privacy/accessLog', () => ({
  recordAdminPrivacyAccess: jest.fn(),
  recordPrivacyAccess: jest.fn(),
}));

import type { GetServerSidePropsContext } from 'next';

import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { recordAdminPrivacyAccess, recordPrivacyAccess } from '../../../lib/privacy/accessLog';
import { listPrivacyAccessActors, listPrivacyAccessLogs } from '../../../lib/privacy/accessLogQuery';
import { getServerSideProps } from '../../../pages/admin/privacy-logs';

const context = (query: Record<string, unknown> = {}) =>
  ({ query }) as unknown as GetServerSidePropsContext;

const ROW = {
  id: 'log-1',
  actor: 'kyungha',
  action: 'funding_resident_number_view' as const,
  targetId: 'proj-1',
  result: 'success' as const,
  rowCount: null,
  ip: '203.0.113.7',
  at: '2026-09-25T01:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
  (listPrivacyAccessLogs as jest.Mock).mockResolvedValue([ROW]);
  (listPrivacyAccessActors as jest.Mock).mockResolvedValue(['admin', 'kyungha']);
});

it('로그인하지 않으면 로그인 화면으로 보낸다', async () => {
  (authenticateAdminRequest as jest.Mock).mockResolvedValue({ ok: false });
  const result = await getServerSideProps(context());
  expect(result).toEqual({ redirect: { destination: '/admin/login', permanent: false } });
  expect(listPrivacyAccessLogs).not.toHaveBeenCalled();
});

it('필터가 없으면 전부 최신순으로 가져온다', async () => {
  const result = await getServerSideProps(context());
  expect(listPrivacyAccessLogs).toHaveBeenCalledWith({ actor: null, action: null });
  expect(result).toMatchObject({ props: { rows: [ROW], actors: ['admin', 'kyungha'] } });
});

it('수행자와 행위로 거른다', async () => {
  await getServerSideProps(context({ actor: 'kyungha', action: 'funding_payout_account_view' }));
  expect(listPrivacyAccessLogs).toHaveBeenCalledWith({
    actor: 'kyungha',
    action: 'funding_payout_account_view',
  });
});

/** 모르는 값을 그대로 질의에 넣으면 빈 화면이 나오고, 왜 빈지는 안 보인다. */
it('모르는 행위 이름은 필터 없음으로 본다', async () => {
  const result = await getServerSideProps(context({ action: '아무거나' }));
  expect(listPrivacyAccessLogs).toHaveBeenCalledWith({ actor: null, action: null });
  expect(result).toMatchObject({ props: { actionFilter: null } });
});

it('형식이 아닌 수행자 값도 필터 없음으로 본다', async () => {
  await getServerSideProps(context({ actor: "kyungha' OR 1=1" }));
  expect(listPrivacyAccessLogs).toHaveBeenCalledWith({ actor: null, action: null });
});

/**
 * 이 화면이 보여 주는 것은 개인정보가 아니라 **접근한 사실**뿐이다(값은 애초에 스키마에
 * 담기지 않는다). 열람을 기록하면 그 기록을 보려고 연 화면이 다시 기록을 낳는다.
 */
it('이 화면을 연 것은 기록하지 않는다', async () => {
  await getServerSideProps(context({ actor: 'kyungha' }));
  expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  expect(recordPrivacyAccess).not.toHaveBeenCalled();
});

it('조회가 실패해도 화면은 뜬다 — 이유를 적어서', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (listPrivacyAccessLogs as jest.Mock).mockRejectedValue(new Error('DB 장애'));
  const result = await getServerSideProps(context());
  expect(result).toMatchObject({ props: { rows: [], error: expect.any(String) } });
  jest.restoreAllMocks();
});
