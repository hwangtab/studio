/** @jest-environment node */

/**
 * 계약 서비스의 DB 동작을 실제 SQLite(in-memory)에서 확인한다.
 *
 * 호실 점유 판정이 틀리면 두 고객이 같은 방을 배정받거나(이중 임대) 비어 있는 방에 새 계약을
 * 만들 수 없고, 계약 생성이 원자적이지 않으면 서명할 수 없는 반쪽 계약이 남는다. 어느 쪽도
 * SQL이 실제로 어떻게 도는지 봐야 알 수 있어 모킹으로는 부족하다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { contractAttachments, contractClauses, contracts, signatures } from '../../db/schema';
import type { ContractStatus } from './status';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import {
  buildSignedContractContent,
  createContract,
  findRoomConflict,
  terminateContract,
} from './service';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const addContract = async (opts: {
  id: string;
  room: string;
  start: string;
  end: string;
  status: ContractStatus;
  terminatedAt?: Date | null;
  name?: string;
}) => {
  const now = new Date();
  await mockDb.insert(contracts).values({
    id: opts.id,
    title: `${opts.name ?? '홍길동'} 계약`,
    customerName: opts.name ?? '홍길동',
    customerEmail: 'a@studionol.co.kr',
    customerPhone: '010-1234-5678',
    roomNumber: opts.room,
    startDate: d(opts.start),
    endDate: d(opts.end),
    monthlyRent: 300000,
    depositAmount: 300000,
    content: '본문',
    status: opts.status,
    terminatedAt: opts.terminatedAt ?? null,
    signToken: `tok_${opts.id}`,
    createdAt: now,
    updatedAt: now,
  });
};

const conflictFor = (room: string, start: string, end: string) =>
  findRoomConflict({ roomNumber: room, startDate: d(start), endDate: d(end) });

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split(
      '--> statement-breakpoint',
    )) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM signatures');
  await client.execute('DELETE FROM contracts');
});

afterAll(() => client.close());

describe('호실 점유 판정', () => {
  describe('서명된 계약은 종료 처리 전까지 방을 잡고 있다', () => {
    beforeEach(async () => {
      await addContract({
        id: 'c1',
        room: '302',
        start: '2026-09-01',
        end: '2027-03-01',
        status: 'signed',
        name: '김기존',
      });
    });

    it('기간이 겹치면 충돌이다', async () => {
      expect(await conflictFor('302', '2026-12-01', '2027-06-01')).not.toBeNull();
    });

    /**
     * 계약서 제3조는 만료일까지 통지가 없으면 1개월씩 자동 갱신된다고 정한다. 기간 겹침만
     * 보면 갱신해서 계속 쓰는 방이 만료 다음 날부터 "비어 있음"이 되어, 이중 임대를 막으려고
     * 만든 검사가 조용히 무력해진다.
     */
    it('계약 기간이 지나도 여전히 충돌이다 (자동 갱신 중일 수 있다)', async () => {
      expect(await conflictFor('302', '2027-06-01', '2027-12-01')).not.toBeNull();
    });

    it('다른 호실은 충돌이 아니다', async () => {
      expect(await conflictFor('303', '2026-12-01', '2027-06-01')).toBeNull();
    });

    it('종료 처리하면 그 즉시 새 계약을 만들 수 있다', async () => {
      const terminated = await terminateContract('c1', { reason: '중도 퇴실(위약금 납부)' });

      expect(terminated).not.toBeNull();
      expect(terminated?.status).toBe('terminated');
      expect(terminated?.terminationReason).toBe('중도 퇴실(위약금 납부)');
      expect(await conflictFor('302', '2026-12-01', '2027-06-01')).toBeNull();
    });

    it('이미 종료된 계약을 다시 종료하지 않는다', async () => {
      await terminateContract('c1', { reason: '기간 만료' });
      expect(await terminateContract('c1', { reason: '중복 클릭' })).toBeNull();

      const after = await mockDb.query.contracts.findFirst({ where: eq(contracts.id, 'c1') });
      expect(after?.terminationReason).toBe('기간 만료');
    });
  });

  describe('발송 대기 계약은 기간이 겹칠 때만 잡는다', () => {
    beforeEach(async () => {
      await addContract({
        id: 'c2',
        room: '302',
        start: '2026-09-01',
        end: '2026-11-30',
        status: 'sent',
      });
    });

    it('겹치면 충돌', async () => {
      expect(await conflictFor('302', '2026-10-01', '2026-12-31')).not.toBeNull();
    });

    it('기간이 지나면 방을 놓아준다 (서명될지 알 수 없는 계약이 무기한 잡지 않도록)', async () => {
      expect(await conflictFor('302', '2026-12-01', '2027-02-28')).toBeNull();
    });

    /** 종료일 당일도 아직 이용 기간이다. 하루 겹치는 계약이 통과하면 그날 두 사람이 온다. */
    it('종료일 당일에 시작하는 계약도 충돌로 잡는다', async () => {
      expect(await conflictFor('302', '2026-11-30', '2027-02-28')).not.toBeNull();
    });

    it('종료일 다음 날부터는 비어 있다', async () => {
      expect(await conflictFor('302', '2026-12-01', '2027-02-28')).toBeNull();
    });
  });

  describe('효력 없는 계약은 방을 잡지 않는다', () => {
    it.each([['draft'], ['cancelled'], ['expired'], ['terminated']] as const)(
      '%s 상태',
      async (status) => {
        await addContract({
          id: `c-${status}`,
          room: '302',
          start: '2026-09-01',
          end: '2027-03-01',
          status: status as ContractStatus,
          terminatedAt: status === 'terminated' ? new Date() : null,
        });

        expect(await conflictFor('302', '2026-10-01', '2027-01-01')).toBeNull();
      },
    );
  });

  it('자기 자신은 충돌로 보지 않는다 (발송 직전 재확인용)', async () => {
    await addContract({
      id: 'c3',
      room: '302',
      start: '2026-09-01',
      end: '2027-03-01',
      status: 'sent',
    });

    const conflict = await findRoomConflict({
      roomNumber: '302',
      startDate: d('2026-09-01'),
      endDate: d('2027-03-01'),
      excludeContractId: 'c3',
    });

    expect(conflict).toBeNull();
  });

  it('종료 처리는 서명된 계약에만 해당한다', async () => {
    await addContract({
      id: 'c4',
      room: '302',
      start: '2026-09-01',
      end: '2027-03-01',
      status: 'sent',
    });

    expect(await terminateContract('c4', { reason: '아직 서명 전' })).toBeNull();
  });
});

/**
 * 계약 하나를 만들려면 네 곳에 써야 한다(계약·서명행·동의 조항·첨부). 나눠 실행하면
 * 중간에 끊겼을 때 화면에는 정상으로 보이지만 서명할 수 없는 계약이 남는다.
 */
describe('계약 생성', () => {
  const payload = {
    title: '홍길동님 음악연습실 이용계약',
    customerName: '홍길동',
    customerEmail: 'a@studionol.co.kr',
    customerPhone: '010-1234-5678',
    roomNumber: '302',
    startDate: '2026-09-01',
    endDate: '2027-03-01',
    monthlyRent: 300000,
    depositAmount: 300000,
    paymentDay: 1,
  };

  it('계약·서명행·동의 조항·첨부가 함께 만들어진다', async () => {
    const contract = await createContract(payload);

    const [sigs, clauses, attachments] = await Promise.all([
      mockDb.select().from(signatures).where(eq(signatures.contractId, contract.id)),
      mockDb.select().from(contractClauses).where(eq(contractClauses.contractId, contract.id)),
      mockDb.select().from(contractAttachments).where(eq(contractAttachments.contractId, contract.id)),
    ]);

    expect(contract.status).toBe('draft');
    expect(sigs).toHaveLength(1);
    expect(sigs[0].status).toBe('pending');
    // 필수 동의가 비어 있으면 아무것도 동의받지 않은 채로 서명이 통과한다.
    expect(clauses.length).toBeGreaterThan(0);
    expect(attachments).toHaveLength(1);
    // 이용수칙은 계약 시점 사본이어야 한다 — 원본 파일이 바뀌어도 이 계약은 그대로다.
    expect(attachments[0].content).toBeTruthy();
  });

  it('서명 토큰이 계약마다 다르다', async () => {
    const a = await createContract(payload);
    const b = await createContract({ ...payload, roomNumber: '303' });

    expect(a.signToken).not.toBe(b.signToken);
    expect(a.id).not.toBe(b.id);
  });
});

/**
 * 생년월일·주소는 운영자가 알 수 없어 당사자가 서명 화면에서 채운다. 그 값으로 계약 본문이
 * 완성된 뒤 그 최종본에 서명이 붙는다 — 지문도 이 본문으로 계산된다.
 */
describe('서명 시점 본문 완성', () => {
  const base = {
    title: '홍길동님 음악연습실 이용계약',
    customerName: '홍길동',
    customerEmail: 'a@studionol.co.kr',
    customerPhone: '010-1234-5678',
    roomNumber: '302',
    startDate: '2026-09-01',
    endDate: '2027-03-01',
    monthlyRent: 300000,
    depositAmount: 300000,
    paymentDay: 1,
  };

  const details = { customerBirthdate: '1990-01-02', customerAddress: '서울시 은평구 대조동' };

  it('발송 시점 본문에는 생년월일·주소 칸이 비어 있다', async () => {
    const contract = await createContract(base);

    expect(contract.content).not.toContain('1990-01-02');
    expect(contract.content).not.toContain('서울시 은평구 대조동');
    // 자리표시자가 남아 있으면 안 된다 — 빈 칸으로 치환돼야 한다.
    expect(contract.content).not.toMatch(/\{\{\w+\}\}/);
  });

  it('고객이 채운 값이 본문에 들어간다', async () => {
    const contract = await createContract(base);
    const signed = buildSignedContractContent(contract, details, new Date('2026-08-20T05:00:00Z'));

    expect(signed).toContain('1990-01-02');
    expect(signed).toContain('서울시 은평구 대조동');
    expect(signed).not.toMatch(/\{\{\w+\}\}/);
  });

  /** 계약일은 초안을 만든 날이 아니라 실제로 서명한 날이다. */
  it('계약일이 서명일로 확정된다', async () => {
    const contract = await createContract(base);
    const signed = buildSignedContractContent(contract, details, new Date('2026-08-20T05:00:00Z'));

    expect(signed).toContain('2026년 8월 20일');
  });

  it('나머지 조건은 발송 시점 그대로다', async () => {
    const contract = await createContract({ ...base, specialTerms: ['주차 1대 제공'] });
    const signed = buildSignedContractContent(contract, details, new Date());

    expect(signed).toContain('302');
    expect(signed).toContain('300,000');
    expect(signed).toContain('주차 1대 제공');
  });

  it('입력값의 표 구분자가 계약서 구조를 깨뜨리지 않는다', async () => {
    const contract = await createContract(base);
    const signed = buildSignedContractContent(
      contract,
      { ...details, customerAddress: '서울시 | 보증금 면제 확정' },
      new Date(),
    );

    const row = signed.split('\n').find((line) => line.includes('보증금 면제 확정')) ?? '';
    expect(row).toContain('\\|');
    expect(row.replace(/\\\|/g, '').split('|').length - 1).toBe(3);
  });
});
