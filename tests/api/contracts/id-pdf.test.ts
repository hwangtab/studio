/** @jest-environment node */

/**
 * 서명 완료 계약의 관리자용 PDF 라우트(pages/api/contracts/[id]/pdf.ts) 핸들러 검증.
 *
 * 이 라우트는 Chromium을 띄워 PDF를 만드는 비용이 큰 경로라, 인증·상태 검사를
 * 통과하기 전에는 렌더링(loadOrRenderContractPdf)에 닿지 않아야 한다. 특히
 * 파기된 계약(purgedAt)은 status가 여전히 'signed'로 남아 있으므로, status만
 * 보고 렌더링하면 이름·본문·서명이 빠진 껍데기 문서가 나간다 — 이 라우트 특유의
 * 함정이라 별도로 확인한다.
 */

jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  authenticateAdminApi: jest.fn(),
}));
jest.mock('../../../lib/contracts/pdf-storage', () => ({
  loadOrRenderContractPdf: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
import { loadOrRenderContractPdf } from '../../../lib/contracts/pdf-storage';
import handler from '../../../pages/api/contracts/[id]/pdf';

const contract = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  customerName: '홍길동',
  status: 'signed',
  purgedAt: null,
  ...overrides,
});

const mockFound = (value: unknown) => {
  const findFirst = jest.fn().mockResolvedValue(value);
  (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });
  return findFirst;
};

const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as unknown as NextApiResponse & Record<string, jest.Mock>;
};

const run = async (overrides: { method?: string; query?: Record<string, unknown> } = {}) => {
  const res = makeRes();
  const req = {
    method: overrides.method ?? 'GET',
    query: overrides.query ?? { id: 'c1' },
    headers: {},
  } as unknown as NextApiRequest;

  await handler(req, res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (loadOrRenderContractPdf as jest.Mock).mockResolvedValue(Buffer.from('%PDF-1.4 fake'));
});

describe('메서드', () => {
  it('GET이 아니면 405이고 인증·조회를 건드리지 않는다', async () => {
    const res = await run({ method: 'POST' });

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
    expect(authenticateAdminApi).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe('인증', () => {
  it('인증 실패면 401이고 DB를 조회하지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });
});

describe('id 파싱', () => {
  it('id가 배열이면 400이고 조회하지 않는다', async () => {
    const findFirst = jest.fn();
    (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });

    const res = await run({ query: { id: ['a', 'b'] } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('id가 없으면 400', async () => {
    const res = await run({ query: {} });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('리소스·상태 검증', () => {
  it('없는 계약은 404이고 렌더링하지 않는다', async () => {
    mockFound(undefined);
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });

  it('서명되지 않은 계약은 409이고 렌더링하지 않는다', async () => {
    mockFound(contract({ status: 'draft' }));
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(409);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });

  /**
   * status는 signed로 남아 있어도 purgedAt이 찍혀 있으면 개인정보가 이미 지워진
   * 상태다. status만 보고 렌더링하면 이름·서명이 빠진 문서가 나간다.
   */
  it('파기된 계약은 status가 signed여도 409이고 렌더링하지 않는다', async () => {
    mockFound(contract({ status: 'signed', purgedAt: new Date('2026-01-01') }));
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(409);
    expect(loadOrRenderContractPdf).not.toHaveBeenCalled();
  });

  it('DB 조회 실패는 500이고 원문을 노출하지 않는다', async () => {
    const findFirst = jest.fn().mockRejectedValue(new Error('turso: connection refused'));
    (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });

    const res = await run();

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('turso');
  });
});

describe('성공 경로', () => {
  it('PDF를 렌더링해 200으로 내려준다', async () => {
    mockFound(contract());
    const res = await run();

    expect(loadOrRenderContractPdf).toHaveBeenCalledWith(contract());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 13);
  });

  it('파일명은 RFC 5987 filename*로 UTF-8 인코딩된다', async () => {
    mockFound(contract({ customerName: '홍길동' }));
    const res = await run();

    const disposition = (res.setHeader as jest.Mock).mock.calls.find(
      ([header]) => header === 'Content-Disposition',
    )?.[1];

    expect(disposition).toContain('attachment; filename="contract-c1.pdf"');
    expect(disposition).toContain(`filename*=UTF-8''${encodeURIComponent('홍길동_이용계약서.pdf')}`);
  });

  it('렌더링 실패는 500이고 원문을 노출하지 않는다', async () => {
    mockFound(contract());
    (loadOrRenderContractPdf as jest.Mock).mockRejectedValue(new Error('chromium spawn failed: ENOENT'));

    const res = await run();

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('chromium');
    expect(body).not.toContain('ENOENT');
  });
});

describe('응답 위생', () => {
  it('405·401을 포함해 모든 응답에 Cache-Control: no-store가 붙는다', async () => {
    const res405 = await run({ method: 'POST' });
    expect(res405.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');

    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const res401 = await run();
    expect(res401.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
