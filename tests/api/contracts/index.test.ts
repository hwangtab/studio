/** @jest-environment node */

/**
 * 계약 목록 조회·생성 라우트(pages/api/contracts/index.ts) 핸들러 검증.
 *
 * 이 라우트는 GET 한 번으로 전 계약의 이름·연락처·주소·서명 이미지가 나온다.
 * 인증이 최상단에서 걸리지 않으면 그 자리에서 개인정보가 새어 나간다 — 그래서
 * "인증 실패 시 DB를 아예 건드리지 않는다"를 이 테스트의 핵심으로 둔다.
 * 순수 함수(validateCreateContractPayload 등)는 lib/contracts/*.test.ts가 이미
 * 검증하므로 여기서는 라우트가 그 결과를 올바른 순서로 소비하는지만 본다.
 */

jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  authenticateAdminApi: jest.fn(),
}));
jest.mock('../../../lib/contracts/serialize', () => ({
  serializeContractForAdmin: jest.fn((contract: { id: string }) => ({ id: contract.id, serialized: true })),
}));
jest.mock('../../../lib/contracts/service', () => ({
  createContract: jest.fn(),
  expireOverdueContracts: jest.fn(),
  findRoomConflict: jest.fn(),
}));
jest.mock('../../../lib/contracts/conflict', () => ({
  describeRoomConflict: jest.fn(() => '호실 충돌 안내'),
}));
jest.mock('../../../lib/contracts/validation', () => ({
  validateCreateContractPayload: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
import { describeRoomConflict } from '../../../lib/contracts/conflict';
import handler from '../../../pages/api/contracts/index';
import { createContract, expireOverdueContracts, findRoomConflict } from '../../../lib/contracts/service';
import { validateCreateContractPayload } from '../../../lib/contracts/validation';

const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as unknown as NextApiResponse & Record<string, jest.Mock>;
};

const run = async (overrides: { method?: string; body?: unknown } = {}) => {
  const res = makeRes();
  const req = {
    method: overrides.method ?? 'GET',
    body: 'body' in overrides ? overrides.body : undefined,
    query: {},
    headers: {},
  } as unknown as NextApiRequest;

  await handler(req, res);
  return res;
};

const VALID_PAYLOAD = {
  title: '연습실 A',
  customerName: '홍길동',
  customerEmail: 'a@b.com',
  customerPhone: '010-1234-5678',
  roomNumber: 'A',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  monthlyRent: 300000,
  depositAmount: 300000,
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (expireOverdueContracts as jest.Mock).mockResolvedValue(0);
  (getDb as jest.Mock).mockReturnValue({
    query: { contracts: { findMany: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]) } },
  });
  (validateCreateContractPayload as jest.Mock).mockReturnValue({ ok: true, data: VALID_PAYLOAD });
  (findRoomConflict as jest.Mock).mockResolvedValue(null);
  (createContract as jest.Mock).mockResolvedValue({ id: 'new-1' });
});

describe('인증', () => {
  it('인증 실패면 401이고 DB를 건드리지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });

    const res = await run({ method: 'GET' });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(expireOverdueContracts).not.toHaveBeenCalled();
  });

  it('POST도 인증 실패면 401이고 생성 로직에 닿지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });

    const res = await run({ method: 'POST', body: VALID_PAYLOAD });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(validateCreateContractPayload).not.toHaveBeenCalled();
    expect(createContract).not.toHaveBeenCalled();
  });
});

describe('GET — 목록 조회', () => {
  it('만료 갱신 후 목록을 직렬화해 200으로 돌려준다', async () => {
    const res = await run({ method: 'GET' });

    expect(expireOverdueContracts).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      contracts: [
        { id: 'c1', serialized: true },
        { id: 'c2', serialized: true },
      ],
    });
  });

  it('DB 오류는 500이고 원문 오류를 노출하지 않는다', async () => {
    (getDb as jest.Mock).mockReturnValue({
      query: { contracts: { findMany: jest.fn().mockRejectedValue(new Error('turso: connection refused')) } },
    });

    const res = await run({ method: 'GET' });

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('turso');
    expect(body).not.toContain('connection refused');
  });
});

describe('POST — 생성', () => {
  it('배열 바디는 400이고 검증조차 하지 않는다', async () => {
    const res = await run({ method: 'POST', body: [] });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(validateCreateContractPayload).not.toHaveBeenCalled();
  });

  it('null 바디는 400', async () => {
    const res = await run({ method: 'POST', body: null });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('검증 실패면 400이고 생성하지 않는다', async () => {
    (validateCreateContractPayload as jest.Mock).mockReturnValue({
      ok: false,
      errors: [{ field: 'customerPhone', message: '올바른 휴대폰 번호가 아닙니다.' }],
    });

    const res = await run({ method: 'POST', body: { title: 'x' } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createContract).not.toHaveBeenCalled();
  });

  it('호실이 겹치면 409이고 생성하지 않는다', async () => {
    (findRoomConflict as jest.Mock).mockResolvedValue({ id: 'existing' });

    const res = await run({ method: 'POST', body: VALID_PAYLOAD });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(describeRoomConflict).toHaveBeenCalledWith({ id: 'existing' });
    expect(createContract).not.toHaveBeenCalled();
  });

  it('충돌이 없으면 생성하고 201', async () => {
    const res = await run({ method: 'POST', body: VALID_PAYLOAD });

    expect(createContract).toHaveBeenCalledWith(VALID_PAYLOAD);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, contract: { id: 'new-1', serialized: true } });
  });

  it('생성 중 예외는 500이고 원문을 노출하지 않는다', async () => {
    (createContract as jest.Mock).mockRejectedValue(new Error('TURSO_AUTH_TOKEN invalid'));

    const res = await run({ method: 'POST', body: VALID_PAYLOAD });

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('TURSO_AUTH_TOKEN');
  });
});

describe('메서드·응답 위생', () => {
  it.each(['PUT', 'DELETE', 'PATCH'])('%s는 405이고 Allow 헤더가 붙는다', async (method) => {
    const res = await run({ method });

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, POST');
  });

  it('모든 응답에 Cache-Control: no-store가 붙는다', async () => {
    for (const method of ['GET', 'POST', 'DELETE']) {
      const res = await run({ method, body: VALID_PAYLOAD });
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    }
  });
});
