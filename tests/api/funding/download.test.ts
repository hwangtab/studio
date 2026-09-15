/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../lib/funding/projects', () => ({ getFundingProject: jest.fn() }));
jest.mock('../../../lib/funding/r2', () => ({ presignFundingDownload: jest.fn() }));
jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/funding/download';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { getFundingProject } from '../../../lib/funding/projects';
import { presignFundingDownload } from '../../../lib/funding/r2';
import { getDb } from '../../../db/client';

/**
 * 이 경로가 지키는 것은 두 가지다.
 *
 * 1. **후원자에게 저장소 주소를 주지 않는다.** 예전에는 확정 메일과 후원 확인 페이지가
 *    R2 공개 주소를 그대로 실어 보냈고, 그 주소로 직접 받으면 `downloaded_at`이 안 찍혀
 *    파일을 전부 받은 뒤 전액 셀프 환불이 성립했다. 지금은 키만 나가고 주소는 여기서
 *    서명해 만든다.
 * 2. **자기 리워드가 주는 파일만.** 키가 목록에 없으면 서명을 받아 낼 수 없어야, 1만원
 *    티어가 파일명을 바꿔 5만원 티어의 원본을 가져가지 못한다.
 */

const KEY = 'kspf-2026/abc123/album-mp3-320.zip';
const HIGHER_KEY = 'kspf-2026/abc123/album-wav-24-96.zip';
const SIGNED = 'https://acct.r2.cloudflarestorage.com/bucket/kspf-2026/abc123/album-mp3-320.zip?X-Amz-Signature=deadbeef';

const updateCall = () => {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  (getDb as jest.Mock).mockReturnValue({ update });
  return { update, set, where };
};

const call = async (query: Record<string, string>) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const redirect = jest.fn();
  const res = { setHeader: jest.fn(), status, redirect } as unknown as NextApiResponse;
  await handler({ method: 'GET', query, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return {
    status: status.mock.calls[0]?.[0] as number | undefined,
    body: json.mock.calls[0]?.[0],
    redirectedTo: redirect.mock.calls[0]?.[1] as string | undefined,
  };
};

const paidOrder = {
  id: 1, orderNo: 'FND-1', manageToken: 'correct-token', status: 'paid',
  fundingPledge: { id: 7, projectSlug: 'demo', rewardId: 'mp3' },
};

const projectWithTiers = {
  rewards: [
    { id: 'mp3', downloads: [{ label: 'MP3', key: KEY }] },
    { id: 'hires', downloads: [{ label: 'MP3', key: KEY }, { label: 'WAV 24/96', key: HIGHER_KEY }] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(paidOrder);
  (getFundingProject as jest.Mock).mockReturnValue(projectWithTiers);
  (presignFundingDownload as jest.Mock).mockResolvedValue(SIGNED);
  updateCall();
});

const ok = { orderNo: 'FND-1', token: 'correct-token', file: KEY };

it('정상 → 서명 주소로 302, 저장소 주소를 응답 본문에 담지 않는다', async () => {
  const r = await call(ok);
  expect(presignFundingDownload).toHaveBeenCalledWith(KEY);
  expect(r.redirectedTo).toBe(SIGNED);
});

it('최초 1회만 기록한다 — downloaded_at이 비어 있을 때만 쓴다', async () => {
  const { update, set } = updateCall();
  await call(ok);
  expect(update).toHaveBeenCalled();
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ downloadedAt: expect.any(Date) }));
});

/**
 * 핵심 회귀. 이 순서가 뒤집히면 발급이 실패한 요청이 `downloaded_at`을 찍어 버린다 —
 * 후원자는 파일을 못 받았는데 셀프 취소만 잃는다.
 */
it('서명 발급이 실패하면 503이고, 내려받음으로 기록하지 않는다', async () => {
  const { update } = updateCall();
  (presignFundingDownload as jest.Mock).mockRejectedValue(new Error('R2_ACCESS_KEY_ID이(가) 없어…'));
  const r = await call(ok);
  expect(r.status).toBe(503);
  expect(update).not.toHaveBeenCalled();
});

it('내 리워드에 없는 키로는 서명을 받아 낼 수 없다 — 상위 티어 파일 가로채기 차단', async () => {
  const r = await call({ ...ok, file: HIGHER_KEY });
  expect(r.status).toBe(404);
  expect(presignFundingDownload).not.toHaveBeenCalled();
});

it('상위 티어는 하위 티어의 파일도 받는다', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue({
    ...paidOrder, fundingPledge: { ...paidOrder.fundingPledge, rewardId: 'hires' },
  });
  expect((await call({ ...ok, file: KEY })).redirectedTo).toBe(SIGNED);
  expect((await call({ ...ok, file: HIGHER_KEY })).redirectedTo).toBe(SIGNED);
});

it('임의의 주소를 넘겨도 그리로 보내지 않는다 (open redirect)', async () => {
  const r = await call({ ...ok, file: 'https://evil.example/payload.zip' });
  expect(r.status).toBe(404);
  expect(r.redirectedTo).toBeUndefined();
});

it('환불된 건에는 내려주지 않는다 — 서명도 발급하지 않는다', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue({ ...paidOrder, status: 'refunded' });
  const r = await call(ok);
  expect(r.status).toBe(409);
  expect(presignFundingDownload).not.toHaveBeenCalled();
});

it('토큰 불일치는 주문 없음과 같은 404 — 주문의 존재를 흘리지 않는다', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(undefined);
  const missing = await call(ok);
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(paidOrder);
  const wrongToken = await call({ ...ok, token: 'wrong-token' });
  expect(wrongToken.status).toBe(missing.status);
  expect(wrongToken.body).toEqual(missing.body);
  expect(wrongToken.status).toBe(404);
});
