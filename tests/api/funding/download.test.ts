/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../lib/funding/projects', () => ({ getFundingProject: jest.fn() }));
jest.mock('../../../lib/funding/r2', () => ({ presignFundingDownload: jest.fn(), fundingDownloadObjectExists: jest.fn() }));
jest.mock('../../../lib/funding/downloadAlert', () => ({ alertMissingDownloadObject: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/funding/download';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { getFundingProject } from '../../../lib/funding/projects';
import { fundingDownloadObjectExists, presignFundingDownload } from '../../../lib/funding/r2';
import { alertMissingDownloadObject } from '../../../lib/funding/downloadAlert';
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

/**
 * 기록은 raw SQL 한 문장이다 — 주문이 아직 살아 있는지를 같은 WHERE에서 보기 때문이다
 * (읽기 시점 판정만으로는 취소와의 경합을 못 막는다. 경합 자체는
 * lib/funding/cancel.integration.test.ts가 실제 DB로 본다). 여기서는 "기록을 시도했는가"와
 * 0행일 때의 응답만 본다.
 */
const updateCall = (rowsAffected = 1) => {
  const run = jest.fn().mockResolvedValue({ rowsAffected });
  (getDb as jest.Mock).mockReturnValue({ run });
  return { run, update: run, set: run };
};

const call = async (body: Record<string, string>, method = 'POST') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const redirect = jest.fn();
  const res = { setHeader: jest.fn(), status, redirect } as unknown as NextApiResponse;
  await handler({ method, body, query: body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
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
  (fundingDownloadObjectExists as jest.Mock).mockResolvedValue(true);
  updateCall();
});

const ok = { orderNo: 'FND-1', token: 'correct-token', file: KEY };

/**
 * 핵심 회귀. GET으로도 기록이 남으면, 확정 메일의 링크를 긁는 검사기·미리보기 봇이
 * 후원자의 청약철회권을 대신 소멸시킨다 — 고지한 조건("내려받기가 시작된 뒤")과 판정
 * 조건("주소에 요청이 한 번 닿음")이 달라져 그 기록은 환불 거절의 근거가 못 된다.
 */
it('GET으로는 아무것도 하지 않는다 — 기록도 서명도 없다', async () => {
  const { update } = updateCall();
  const r = await call(ok, 'GET');
  expect(r.status).toBe(405);
  expect(update).not.toHaveBeenCalled();
  expect(presignFundingDownload).not.toHaveBeenCalled();
});

it('쿼리스트링만으로는 통하지 않는다 — 본문으로 온 값만 본다', async () => {
  const { update } = updateCall();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const redirect = jest.fn();
  const res = { setHeader: jest.fn(), status, redirect } as unknown as NextApiResponse;
  await handler({ method: 'POST', body: {}, query: ok, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  expect(status.mock.calls[0][0]).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it('정상 → 서명 주소로 302, 저장소 주소를 응답 본문에 담지 않는다', async () => {
  const r = await call(ok);
  expect(presignFundingDownload).toHaveBeenCalledWith(KEY);
  expect(r.redirectedTo).toBe(SIGNED);
});

it('첫 시각을 보존하며 기록한다 — 두 번째 내려받기가 기준점을 밀지 않는다', async () => {
  const { run } = updateCall();
  await call(ok);
  expect(run).toHaveBeenCalled();
  const statement = JSON.stringify(run.mock.calls[0][0]);
  expect(statement).toContain('COALESCE(downloaded_at');
});

/**
 * 읽기와 쓰기 사이에 취소가 끼어들면 0행이 된다 — 그때 서명 주소를 내주면 돈은 돌아가고
 * 파일은 나간다. 302 대신 409로 끊는다.
 */
it('기록이 0행이면(그 사이 취소됨) 서명 주소를 내주지 않고 409', async () => {
  updateCall(0);
  const r = await call(ok);
  expect(r.status).toBe(409);
  expect(r.redirectedTo).toBeUndefined();
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

/**
 * 서명은 객체 유무를 모른다 — `client.sign`은 순수 계산이다. 키 오타·파일 교체·삭제
 * 상태에서도 주소가 만들어지고, 302를 받은 후원자는 R2의 NoSuchKey XML을 보는데
 * `downloaded_at`은 이미 찍혀 청약철회권만 잃는다. 주석이 약속한 "발급 실패면 기록을
 * 남기지 않는다"가 이 경우에도 사실이어야 한다.
 */
describe('저장소에 객체가 없을 때', () => {
  it('HEAD가 404면 기록하지 않고 503으로 답하며 운영자에게 알린다', async () => {
    const { update } = updateCall();
    (fundingDownloadObjectExists as jest.Mock).mockResolvedValue(false);
    const r = await call(ok);
    expect(r.status).toBe(503);
    expect(r.body.message).toContain('파일을 준비하지 못했습니다');
    expect(update).not.toHaveBeenCalled();
    expect(r.redirectedTo).toBeUndefined();
    expect(alertMissingDownloadObject).toHaveBeenCalledWith({ key: KEY, orderNo: 'FND-1' });
  });

  it('HEAD 자체가 실패하면(네트워크·5xx) 재시도를 안내하고 헛경보를 보내지 않는다', async () => {
    const { update } = updateCall();
    (fundingDownloadObjectExists as jest.Mock).mockRejectedValue(new Error('ECONNRESET'));
    const r = await call(ok);
    expect(r.status).toBe(503);
    expect(r.body.message).toContain('잠시 후 다시 시도');
    expect(update).not.toHaveBeenCalled();
    expect(alertMissingDownloadObject).not.toHaveBeenCalled();
  });

  it('객체가 있으면 지금처럼 기록하고 302로 보낸다', async () => {
    const { update } = updateCall();
    const r = await call(ok);
    expect(update).toHaveBeenCalled();
    expect(r.redirectedTo).toBe(SIGNED);
    expect(alertMissingDownloadObject).not.toHaveBeenCalled();
  });
});
