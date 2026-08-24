/** @jest-environment node */

/**
 * 계약 단건 조회·수정·삭제·발송 라우트(pages/api/contracts/[id].ts) 핸들러 검증.
 *
 * 이 한 파일이 action 분기(send/resend/cancel/update/terminate)와 DELETE를 모두
 * 처리한다. 인증이 조회보다 먼저 걸리는지, id 파싱이 실패해도 크래시하지 않는지,
 * 발송 성공 시 알림이 waitUntil로 배선되고 그 실패가 응답을 깨뜨리지 않는지가
 * 핵심이다. 상태 전이 규칙 자체(checkAction)는 lib/contracts/status.test.ts가 이미
 * 순수 함수로 검증했으므로 여기서는 실제 status.ts를 그대로 쓰고, 라우트가 그
 * 판정을 405/409로 올바르게 반영하는지만 본다.
 */

jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  authenticateAdminApi: jest.fn(),
}));
jest.mock('../../../lib/contracts/serialize', () => ({
  serializeContractForAdmin: jest.fn((contract: { id: string }) => ({ id: contract.id, serialized: true })),
  serializeSignature: jest.fn((s: unknown) => s),
  serializeClause: jest.fn((c: unknown) => c),
  serializeAttachment: jest.fn((a: unknown) => a),
}));
jest.mock('../../../lib/contracts/service', () => ({
  cancelContract: jest.fn(),
  deleteContract: jest.fn(),
  findRoomConflict: jest.fn(),
  markContractSent: jest.fn(),
  sendContractNotifications: jest.fn(),
  terminateContract: jest.fn(),
  updateDraftContract: jest.fn(),
}));
jest.mock('../../../lib/contracts/conflict', () => ({
  describeRoomConflict: jest.fn(() => '호실 충돌 안내'),
}));
jest.mock('../../../lib/contracts/validation', () => ({
  validateCreateContractPayload: jest.fn(),
}));
jest.mock('@vercel/functions', () => ({ waitUntil: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import { waitUntil } from '@vercel/functions';

import { getDb } from '../../../db/client';
import { authenticateAdminApi } from '../../../lib/contracts/admin-auth';
import { describeRoomConflict } from '../../../lib/contracts/conflict';
import handler from '../../../pages/api/contracts/[id]';
import {
  cancelContract,
  deleteContract,
  findRoomConflict,
  markContractSent,
  sendContractNotifications,
  terminateContract,
  updateDraftContract,
} from '../../../lib/contracts/service';
import { validateCreateContractPayload } from '../../../lib/contracts/validation';

const contract = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  status: 'draft',
  roomNumber: 'A',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  expiresAt: null,
  customerName: '홍길동',
  signatures: [],
  contractClauses: [],
  contractAttachments: [],
  ...overrides,
});

const mockFound = (value: unknown) => {
  const findFirst = jest.fn().mockResolvedValue(value);
  (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });
  return findFirst;
};

const mockFindFirstRejects = (error: unknown) => {
  const findFirst = jest.fn().mockRejectedValue(error);
  (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });
  return findFirst;
};

const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as unknown as NextApiResponse & Record<string, jest.Mock>;
};

const run = async (
  overrides: { method?: string; query?: Record<string, unknown>; body?: unknown } = {},
) => {
  const res = makeRes();
  const req = {
    method: overrides.method ?? 'GET',
    query: overrides.query ?? { id: 'c1' },
    body: 'body' in overrides ? overrides.body : undefined,
    headers: {},
  } as unknown as NextApiRequest;

  await handler(req, res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
});

describe('인증', () => {
  it('인증 실패면 401이고 DB를 조회하지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const res = await run({ method: 'GET' });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe('id 파싱', () => {
  it('id가 배열이면 400이고 조회하지 않는다', async () => {
    const findFirst = jest.fn();
    (getDb as jest.Mock).mockReturnValue({ query: { contracts: { findFirst } } });

    const res = await run({ query: { id: ['c1', 'c2'] } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('id가 없으면 400', async () => {
    const res = await run({ query: {} });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('조회 실패', () => {
  it('없는 계약은 404', async () => {
    mockFound(undefined);
    const res = await run();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  /**
   * 장애와 "없음"을 구분한다.
   *
   * 예전에는 쿼리 오류를 catch해 null로 뭉개서, Turso 타임아웃이 관리자 화면에
   * "계약을 찾을 수 없습니다"로 나왔다. 계약이 사라진 줄 알고 다시 만들거나
   * 고객에게 잘못 안내할 수 있는 오분류다. [id]/pdf.ts는 같은 상황을 이미
   * 500으로 처리하고 있어 두 라우트가 서로 달랐다.
   */
  it('DB 조회가 던지면 404가 아니라 500 — 장애를 "없음"으로 오분류하지 않는다', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFindFirstRejects(new Error('turso: timeout'));
    const res = await run();

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('turso');
    expect(body).not.toContain('timeout');
  });
});

describe('GET — 단건 조회', () => {
  it('계약·서명·조항·첨부를 함께 돌려준다', async () => {
    mockFound(
      contract({
        signatures: [{ id: 's1' }],
        contractClauses: [{ id: 'cl1' }],
        contractAttachments: [{ id: 'a1' }],
      }),
    );

    const res = await run();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      contract: { id: 'c1', serialized: true },
      signatures: [{ id: 's1' }],
      clauses: [{ id: 'cl1' }],
      attachments: [{ id: 'a1' }],
    });
  });
});

describe('PATCH — 입력 검증', () => {
  it('배열 바디는 400', async () => {
    mockFound(contract());
    const res = await run({ method: 'PATCH', body: [] });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('허용되지 않는 action은 400이고 후보 목록을 알려준다', async () => {
    mockFound(contract());
    const res = await run({ method: 'PATCH', body: { action: 'explode' } });

    expect(res.status).toHaveBeenCalledWith(400);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).toContain('send');
  });

  it('현재 상태에서 허용되지 않는 action은 409', async () => {
    // signed 상태에는 send가 불가(checkAction 실제 규칙)
    mockFound(contract({ status: 'signed' }));
    const res = await run({ method: 'PATCH', body: { action: 'send' } });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(markContractSent).not.toHaveBeenCalled();
  });
});

describe('PATCH action=update', () => {
  const validPayload = {
    title: 't',
    customerName: '홍길동',
    customerEmail: 'a@b.com',
    customerPhone: '010-1234-5678',
    roomNumber: 'A',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    monthlyRent: 300000,
    depositAmount: 300000,
  };

  it('검증 실패면 400이고 저장하지 않는다', async () => {
    mockFound(contract({ status: 'draft' }));
    (validateCreateContractPayload as jest.Mock).mockReturnValue({
      ok: false,
      errors: [{ field: 'customerPhone', message: '형식 오류' }],
    });

    const res = await run({ method: 'PATCH', body: { action: 'update', ...validPayload } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(updateDraftContract).not.toHaveBeenCalled();
  });

  it('호실 충돌이면 409이고 저장하지 않는다', async () => {
    mockFound(contract({ status: 'draft' }));
    (validateCreateContractPayload as jest.Mock).mockReturnValue({ ok: true, data: validPayload });
    (findRoomConflict as jest.Mock).mockResolvedValue({ id: 'other' });

    const res = await run({ method: 'PATCH', body: { action: 'update', ...validPayload } });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(describeRoomConflict).toHaveBeenCalled();
    expect(updateDraftContract).not.toHaveBeenCalled();
  });

  it('조회와 저장 사이 상태가 바뀌면(동시 발송) 409', async () => {
    mockFound(contract({ status: 'draft' }));
    (validateCreateContractPayload as jest.Mock).mockReturnValue({ ok: true, data: validPayload });
    (findRoomConflict as jest.Mock).mockResolvedValue(null);
    (updateDraftContract as jest.Mock).mockResolvedValue(null);

    const res = await run({ method: 'PATCH', body: { action: 'update', ...validPayload } });

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('성공하면 200과 갱신된 계약을 돌려준다', async () => {
    mockFound(contract({ status: 'draft' }));
    (validateCreateContractPayload as jest.Mock).mockReturnValue({ ok: true, data: validPayload });
    (findRoomConflict as jest.Mock).mockResolvedValue(null);
    (updateDraftContract as jest.Mock).mockResolvedValue(contract({ id: 'c1' }));

    const res = await run({ method: 'PATCH', body: { action: 'update', ...validPayload } });

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('PATCH action=terminate', () => {
  it('종료 사유가 없으면 400이고 종료 처리하지 않는다', async () => {
    mockFound(contract({ status: 'signed' }));
    const res = await run({ method: 'PATCH', body: { action: 'terminate', reason: '  ' } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(terminateContract).not.toHaveBeenCalled();
  });

  it('사유가 500자를 넘으면 400', async () => {
    mockFound(contract({ status: 'signed' }));
    const res = await run({
      method: 'PATCH',
      body: { action: 'terminate', reason: 'x'.repeat(501) },
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(terminateContract).not.toHaveBeenCalled();
  });

  it('동시 처리로 상태가 바뀌면 409', async () => {
    mockFound(contract({ status: 'signed' }));
    (terminateContract as jest.Mock).mockResolvedValue(null);

    const res = await run({ method: 'PATCH', body: { action: 'terminate', reason: '이용 종료' } });
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('성공하면 사유를 trim해 서비스에 넘기고 200', async () => {
    mockFound(contract({ status: 'signed' }));
    (terminateContract as jest.Mock).mockResolvedValue(contract({ status: 'terminated' }));

    const res = await run({ method: 'PATCH', body: { action: 'terminate', reason: '  이용 종료  ' } });

    expect(terminateContract).toHaveBeenCalledWith('c1', { reason: '이용 종료' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('PATCH action=cancel', () => {
  it('동시 처리로 상태가 바뀌면 409', async () => {
    mockFound(contract({ status: 'draft' }));
    (cancelContract as jest.Mock).mockResolvedValue(null);

    const res = await run({ method: 'PATCH', body: { action: 'cancel' } });
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('성공하면 200', async () => {
    mockFound(contract({ status: 'draft' }));
    (cancelContract as jest.Mock).mockResolvedValue(contract({ status: 'cancelled' }));

    const res = await run({ method: 'PATCH', body: { action: 'cancel' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('PATCH action=send/resend — 발송', () => {
  it('발송 직전 호실 충돌이 재확인되면 409이고 발송하지 않는다', async () => {
    mockFound(contract({ status: 'draft' }));
    (findRoomConflict as jest.Mock).mockResolvedValue({ id: 'other' });

    const res = await run({ method: 'PATCH', body: { action: 'send' } });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(markContractSent).not.toHaveBeenCalled();
  });

  it('동시 발송으로 이미 처리됐으면 409', async () => {
    mockFound(contract({ status: 'draft' }));
    (findRoomConflict as jest.Mock).mockResolvedValue(null);
    (markContractSent as jest.Mock).mockResolvedValue(null);

    const res = await run({ method: 'PATCH', body: { action: 'send' } });
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('성공하면 markContractSent에 draft만 허용해 호출하고, 알림을 waitUntil로 배선한다', async () => {
    mockFound(contract({ status: 'draft' }));
    (findRoomConflict as jest.Mock).mockResolvedValue(null);
    const sentResult = { contract: contract({ status: 'sent' }), signUrl: 'https://x/sign/tok' };
    (markContractSent as jest.Mock).mockResolvedValue(sentResult);
    (sendContractNotifications as jest.Mock).mockResolvedValue(undefined);

    const res = await run({ method: 'PATCH', body: { action: 'send' } });

    expect(markContractSent).toHaveBeenCalledWith('c1', { allowedStatuses: ['draft'] });
    expect(sendContractNotifications).toHaveBeenCalledWith(sentResult.contract, sentResult.signUrl);
    expect(waitUntil).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('resend는 sent/expired/cancelled만 허용 상태로 넘긴다', async () => {
    mockFound(contract({ status: 'expired', expiresAt: new Date('2020-01-01') }));
    (findRoomConflict as jest.Mock).mockResolvedValue(null);
    (markContractSent as jest.Mock).mockResolvedValue({
      contract: contract({ status: 'sent' }),
      signUrl: 'https://x/sign/tok',
    });
    (sendContractNotifications as jest.Mock).mockResolvedValue(undefined);

    await run({ method: 'PATCH', body: { action: 'resend' } });

    expect(markContractSent).toHaveBeenCalledWith('c1', {
      allowedStatuses: ['sent', 'expired', 'cancelled'],
    });
  });

  /**
   * 알림 발송(메일 등)이 실패해도 관리자는 이미 200을 받은 뒤다 — waitUntil은
   * 응답을 기다리지 않으므로 여기서 reject해도 핸들러가 던지거나 응답이 바뀌지 않는다.
   */
  it('알림 발송이 나중에 실패해도 이미 보낸 응답은 200 그대로다', async () => {
    mockFound(contract({ status: 'draft' }));
    (findRoomConflict as jest.Mock).mockResolvedValue(null);
    (markContractSent as jest.Mock).mockResolvedValue({
      contract: contract({ status: 'sent' }),
      signUrl: 'https://x/sign/tok',
    });
    const rejected = Promise.reject(new Error('resend down'));
    rejected.catch(() => {}); // 테스트 자체가 unhandled rejection으로 실패하지 않도록 흡수
    (sendContractNotifications as jest.Mock).mockReturnValue(rejected);

    const res = await run({ method: 'PATCH', body: { action: 'send' } });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('action 처리 중 예외는 500이고 원문을 노출하지 않는다', async () => {
    mockFound(contract({ status: 'draft' }));
    (findRoomConflict as jest.Mock).mockRejectedValue(new Error('TURSO_AUTH_TOKEN missing'));

    const res = await run({ method: 'PATCH', body: { action: 'send' } });

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('TURSO_AUTH_TOKEN');
  });
});

describe('DELETE', () => {
  it('서명 완료 계약은 삭제 규칙상 409이고 삭제하지 않는다', async () => {
    mockFound(contract({ status: 'signed' }));
    const res = await run({ method: 'DELETE' });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(deleteContract).not.toHaveBeenCalled();
  });

  it('동시 변경으로 삭제 대상이 사라지면 409', async () => {
    mockFound(contract({ status: 'draft' }));
    (deleteContract as jest.Mock).mockResolvedValue(false);

    const res = await run({ method: 'DELETE' });
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('성공하면 200', async () => {
    mockFound(contract({ status: 'draft' }));
    (deleteContract as jest.Mock).mockResolvedValue(true);

    const res = await run({ method: 'DELETE' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('삭제 중 예외는 500이고 원문을 노출하지 않는다', async () => {
    mockFound(contract({ status: 'draft' }));
    (deleteContract as jest.Mock).mockRejectedValue(new Error('turso: disk I/O error'));

    const res = await run({ method: 'DELETE' });

    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('turso');
  });
});

describe('메서드·응답 위생', () => {
  it.each(['PUT', 'POST'])('%s는 405이고 Allow 헤더가 붙는다', async (method) => {
    mockFound(contract());
    const res = await run({ method });

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, PATCH, DELETE');
  });

  it('성공·실패 모두 Cache-Control: no-store가 붙는다', async () => {
    mockFound(contract());
    const res = await run({ method: 'GET' });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
