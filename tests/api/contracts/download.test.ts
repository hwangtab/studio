/** @jest-environment node */

/**
 * 서명본 재발급 라우트의 핸들러 검증.
 *
 * 이 경로는 성명·생년월일·주소·서명 이미지가 박힌 PDF를 내려 준다. 예전에는 토큰만
 * 맞으면 내려 줬는데, 그 토큰은 완료 메일에 영구 링크로 실려 있고 서명 후에도
 * 만료되지 않는다 — 메일을 전달받은 사람이나 공용 브라우저 이력에서 URL을 얻은
 * 사람이 몇 년 뒤에도 받을 수 있었다. 서명할 때는 연락처 뒷자리를 요구하면서
 * 서명본을 받을 때는 요구하지 않은 비대칭이 문제의 핵심이었다.
 *
 * 라우트 자체(메서드 분기·상태 코드·검사 순서)를 돌린다. 순수 함수 단위 테스트는
 * 이 배선이 빠져도 잡지 못한다.
 */

jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../lib/contracts/pdf-storage', () => ({
  loadOrRenderContractPdf: jest.fn(),
}));
jest.mock('../../../lib/contracts/admin-rate-limit', () => ({
  checkDownloadIdentityAttempt: jest.fn().mockResolvedValue('ok'),
  checkDownloadRateLimit: jest.fn().mockResolvedValue(true),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import {
  checkDownloadIdentityAttempt,
  checkDownloadRateLimit,
} from '../../../lib/contracts/admin-rate-limit';
import { loadOrRenderContractPdf } from '../../../lib/contracts/pdf-storage';
import handler from '../../../pages/api/contracts/[id]/download';

const TOKEN = 'tok_qwertyuiopasdfgh';
const PHONE = '010-1234-5678';
const DIGITS = '5678';

const contract = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  customerName: '홍길동',
  customerPhone: PHONE,
  status: 'signed',
  purgedAt: null,
  ...overrides,
});

const mockFound = (value: unknown) => {
  (getDb as jest.Mock).mockReturnValue({
    query: { contracts: { findFirst: jest.fn().mockResolvedValue(value) } },
  });
};

const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res as unknown as NextApiResponse & Record<string, jest.Mock>;
};

const run = async (
  overrides: {
    method?: string;
    query?: Record<string, unknown>;
    body?: unknown;
  } = {},
) => {
  const res = makeRes();
  const req = {
    method: overrides.method ?? 'POST',
    query: overrides.query ?? { id: 'c1', token: TOKEN },
    body: 'body' in overrides ? overrides.body : { identityDigits: DIGITS },
    headers: {},
  } as unknown as NextApiRequest;

  await handler(req, res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  (checkDownloadIdentityAttempt as jest.Mock).mockResolvedValue('ok');
  (checkDownloadRateLimit as jest.Mock).mockResolvedValue(true);
  (loadOrRenderContractPdf as jest.Mock).mockResolvedValue(Buffer.from('%PDF-1.4 fake'));
});

describe('GET — 이미 발송된 메일의 옛 링크', () => {
  /**
   * 405를 돌려주면 고객이 몇 년 뒤 메일 링크를 눌렀을 때 오류 화면을 본다.
   * 뒷자리를 입력할 수 있는 완료 페이지로 보낸다.
   */
  it('완료 페이지로 302 리다이렉트한다', async () => {
    mockFound(contract());
    const res = await run({ method: 'GET' });

    expect(res.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('/contracts/c1/complete'),
    );
    expect(res.send).not.toHaveBeenCalled();
  });

  it('리다이렉트 전에 계약을 조회하지 않는다 (토큰 유효성 노출 금지)', async () => {
    const findFirst = jest.fn();
    (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });

    await run({ method: 'GET' });
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe('메서드·입력 검증', () => {
  it('PUT은 405', async () => {
    const res = await run({ method: 'PUT' });
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('토큰이 없으면 400 — 계약을 조회조차 하지 않는다', async () => {
    const findFirst = jest.fn();
    (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });

    const res = await run({ query: { id: 'c1' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('없는 계약은 404', async () => {
    mockFound(undefined);
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('본인 확인', () => {
  it('뒷자리가 맞으면 PDF를 내려 준다', async () => {
    mockFound(contract());
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  });

  it('뒷자리가 틀리면 400이고 PDF를 만들지 않는다', async () => {
    mockFound(contract());
    const res = await run({ body: { identityDigits: '0000' } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  /** 토큰만으로 내려받히던 것이 이 라운드에서 고친 구멍이다. */
  it('뒷자리를 아예 안 보내면 거부한다 — 토큰만으로는 못 받는다', async () => {
    mockFound(contract());
    const res = await run({ body: {} });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });

  it('바디가 없어도 크래시하지 않고 400', async () => {
    mockFound(contract());
    const res = await run({ body: undefined });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });

  /**
   * 대조보다 시도 제한이 먼저 와야 한다. 뒤에 두면 틀린 입력이 카운트되지 않아
   * 네 자리 대입을 막지 못한다.
   */
  it('틀린 입력도 시도로 계수된다', async () => {
    mockFound(contract());
    await run({ body: { identityDigits: '0000' } });

    expect(checkDownloadIdentityAttempt).toHaveBeenCalledWith('c1');
  });

  it('시도 제한에 걸리면 429이고 대조까지 가지 않는다', async () => {
    mockFound(contract());
    (checkDownloadIdentityAttempt as jest.Mock).mockResolvedValue('throttled');

    const res = await run();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });

  it('누적 상한에 걸리면 429', async () => {
    mockFound(contract());
    (checkDownloadIdentityAttempt as jest.Mock).mockResolvedValue('locked');

    const res = await run();
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('계약 상태', () => {
  it('서명 전 계약은 409 — 본인 확인 이전에 끊는다', async () => {
    mockFound(contract({ status: 'sent' }));
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(409);
    expect(checkDownloadIdentityAttempt).not.toHaveBeenCalled();
  });

  it('파기된 계약은 409', async () => {
    mockFound(contract({ purgedAt: new Date('2030-01-01T00:00:00Z') }));
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(409);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });
});

describe('재발급 부하 제한', () => {
  it('본인 확인을 통과해도 재발급 제한에 걸리면 429', async () => {
    mockFound(contract());
    (checkDownloadRateLimit as jest.Mock).mockResolvedValue(false);

    const res = await run();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });
});

describe('응답 위생', () => {
  it('캐시를 금지한다 — 서명본은 개인정보다', async () => {
    mockFound(contract());
    const res = await run();

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
