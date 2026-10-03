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
import {
  contractAttachments,
  contractClauses,
  contractTemplateSnapshots,
  contracts,
  signatures,
} from '../../db/schema';
import type { ContractStatus } from './status';
import { readContractTemplate } from './template';
import { hashTemplate, loadTemplateSnapshot } from './template-snapshot';
import { roomComparisonKey } from './validation';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import {
  buildSignedContractContent,
  createContract,
  findRoomConflict,
  markContractSent,
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

describe('호실 비교 키 — SQL과 JS가 같은 규칙', () => {
  /**
   * 컬럼 쪽은 SQL(ROOM_KEY_SQL)로, 파라미터 쪽은 JS로 키를 만든다. 둘이 한 글자라도 다르면 같은 방이
   * 다른 방으로 보여 이중 임대가 통과한다. 예전엔 파라미터를 저장 정규화(끝의 호/호실만 제거)로
   * 맞춰 "2호-1"이 컬럼 쪽 "2-1"과 영영 같아지지 않았다.
   */
  it.each(['2호-1', '302호', '302호실', 'b 101호', 'B101', '2호실-3호', ' 3 0 2 ', 'ä호b', '호'])(
    'SQLite의 키와 같다: %p',
    async (raw) => {
      const result = await client.execute({
        sql: "select replace(replace(replace(upper(?), ' ', ''), '호실', ''), '호', '') as k",
        args: [raw],
      });
      expect(roomComparisonKey(raw)).toBe(result.rows[0].k);
    },
  );

  it('"2호-1"로 저장된 서명 계약을 같은 표기로 다시 잡으면 충돌이다', async () => {
    await addContract({ id: 'c1', room: '2호-1', start: '2026-09-01', end: '2027-03-01', status: 'signed' });
    expect(await conflictFor('2호-1', '2026-12-01', '2027-06-01')).not.toBeNull();
    expect(await conflictFor('2-1', '2026-12-01', '2027-06-01')).not.toBeNull();
  });

  it('소문자로 적어도 같은 방이다', async () => {
    await addContract({ id: 'c1', room: 'B101', start: '2026-09-01', end: '2027-03-01', status: 'sent' });
    expect(await conflictFor('b101', '2026-12-01', '2027-06-01')).not.toBeNull();
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

  it('API로 미리 채워 보내도 생년월일·주소는 저장하지도 본문에 쓰지도 않는다', async () => {
    const contract = await createContract({ ...base, customerBirthdate: '1985-05-05', customerAddress: '미리 적은 주소' });

    expect(contract.customerBirthdate).toBeNull();
    expect(contract.customerAddress).toBeNull();
    expect(contract.content).not.toContain('1985-05-05');
    expect(contract.content).not.toContain('미리 적은 주소');
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

  /**
   * 계약일은 KST 기준이다. 2026-08-31T16:00:00Z는 KST로 9월 1일 오전 1시다.
   * template.ts가 timeZone 없이 formatDate를 쓰던 시절엔 서버(UTC)에서 "8월 31일"로
   * 찍혀 같은 PDF의 서명 일시(KST "9월 1일")와 하루 어긋났고, 그 본문이 contentHash에
   * 박혀 사후 수정도 불가능했다. format.ts로 통일한 지금은 어느 머신에서 돌려도 9월 1일이다.
   */
  it('새벽 서명(KST)도 계약일이 하루 앞당겨지지 않는다', async () => {
    const contract = await createContract(base);
    const signed = buildSignedContractContent(contract, details, new Date('2026-08-31T16:00:00Z'));

    expect(signed).toContain('2026년 9월 1일');
    expect(signed).not.toContain('8월 31일');
  });

  it('나머지 조건은 발송 시점 그대로다', async () => {
    const contract = await createContract({ ...base, specialTerms: ['주차 1대 제공'] });
    const signed = buildSignedContractContent(contract, details, new Date());

    expect(signed).toContain('302');
    expect(signed).toContain('300,000');
    expect(signed).toContain('주차 1대 제공');
  });

  describe('템플릿 사본 (발송 뒤 템플릿이 바뀌어도 읽은 본문으로 서명한다)', () => {
    it('계약을 만들면 그때의 템플릿 원문을 사본으로 남긴다', async () => {
      const contract = await createContract(base);
      const row = await mockDb.query.contractTemplateSnapshots.findFirst({
        where: eq(contractTemplateSnapshots.contractId, contract.id),
      });

      expect(row?.template).toBe(readContractTemplate());
      expect(row?.templateHash).toBe(hashTemplate(readContractTemplate()));
    });

    it('서명 본문은 현재 파일이 아니라 사본으로 완성된다', async () => {
      const contract = await createContract(base);
      // 발송 뒤 contract-template.md가 바뀐 상황: 사본은 옛 판본, 파일은 새 판본이다.
      const oldTemplate = readContractTemplate().replace('{{customerName}}', '{{customerName}} [옛 판본]');
      await mockDb
        .update(contractTemplateSnapshots)
        .set({ template: oldTemplate })
        .where(eq(contractTemplateSnapshots.contractId, contract.id));

      const snapshot = await loadTemplateSnapshot(contract.id);
      const signed = buildSignedContractContent(contract, details, new Date(), snapshot);
      const fromFile = buildSignedContractContent(contract, details, new Date());

      expect(signed).toContain('[옛 판본]');
      expect(fromFile).not.toContain('[옛 판본]');
    });

    it('사본이 없는 옛 계약은 현재 파일로 완성된다(옛 동작)', async () => {
      const contract = await createContract(base);
      await mockDb.delete(contractTemplateSnapshots).where(eq(contractTemplateSnapshots.contractId, contract.id));

      expect(await loadTemplateSnapshot(contract.id)).toBeNull();
      const signed = buildSignedContractContent(contract, details, new Date(), null);
      expect(signed).toContain('1990-01-02');
    });

    it('표가 아직 없는 환경(마이그레이션 전)에서도 던지지 않고 null이다', async () => {
      await client.execute('DROP TABLE contract_template_snapshots');
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      expect(await loadTemplateSnapshot('아무-계약')).toBeNull();
      spy.mockRestore();
    });
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

describe('개인정보가 파기된 계약은 재발송으로 되살리지 못한다', () => {
  it('purgedAt이 있으면 expired여도 markContractSent가 null이다', async () => {
    await addContract({ id: 'purged1', room: '401', start: '2024-01-01', end: '2024-12-31', status: 'expired' });
    await mockDb.update(contracts).set({ purgedAt: new Date() }).where(eq(contracts.id, 'purged1'));

    const result = await markContractSent('purged1', { allowedStatuses: ['expired'] });
    expect(result).toBeNull();
  });
});

describe('호실 점유 판정 — 표기 차이와 동시 발송', () => {
  it('"301"과 "301호"는 같은 방으로 본다', async () => {
    await addContract({ id: 'rs1', room: '301호', start: '2026-10-01', end: '2027-03-31', status: 'signed' });

    const conflict = await findRoomConflict({
      roomNumber: '301',
      startDate: d('2026-11-01'),
      endDate: d('2027-02-28'),
    });
    expect(conflict?.id).toBe('rs1');
  });

  it('같은 호실의 초안 둘을 동시에 발송하면 한 쪽만 발송된다', async () => {
    await addContract({ id: 'da', room: '505', start: '2026-10-01', end: '2027-03-31', status: 'draft' });
    await addContract({ id: 'db', room: '505호', start: '2026-12-01', end: '2027-05-31', status: 'draft', name: '이영희' });

    const results = await Promise.all([
      markContractSent('da', { allowedStatuses: ['draft'] }),
      markContractSent('db', { allowedStatuses: ['draft'] }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const statuses = (await mockDb.select({ id: contracts.id, status: contracts.status }).from(contracts)).filter((c) =>
      ['da', 'db'].includes(c.id),
    );
    expect(statuses.filter((c) => c.status === 'sent')).toHaveLength(1);
  });

  it('기간이 겹치지 않는 발송 대기 계약은 서로 막지 않는다', async () => {
    await addContract({ id: 'ea', room: '506', start: '2026-01-01', end: '2026-06-30', status: 'draft' });
    await addContract({ id: 'eb', room: '506', start: '2026-09-01', end: '2027-02-28', status: 'draft', name: '박민수' });

    const a = await markContractSent('ea', { allowedStatuses: ['draft'] });
    const b = await markContractSent('eb', { allowedStatuses: ['draft'] });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });
});
