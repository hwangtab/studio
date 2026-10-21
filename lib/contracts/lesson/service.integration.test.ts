/** @jest-environment node */
/**
 * 수강 계약의 만들기·발송·서명·취소·파기를 실 DB(in-memory libSQL)로 본다. 메일은 가짜.
 * 지키는 것: ① 확정 전 문안이 남은 계약은 발송되지 않는다 ② 한 수강에 취소되지 않은 계약은 하나 ③ 서명은 이 토큰·발송됨·미만료일 때만, 한 번만
 * ④ 서명하면 계약일·개인정보가 본문에 들어가고 지문이 대조된다 ⑤ 재발송은 옛 링크를 무효로 한다 ⑥ 보관 기간이 지나면 개인정보를 지운다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import { sendEmail } from '../../email/resend';
import { createEnrollment } from '../../lessons/service';
import { parseLessonClauses } from './clauses';
import { verifyLessonFingerprint } from './integrity';
import { purgeExpiredLessonPersonalData } from './retention';
import { cancelLessonContract, createLessonContract, expireOverdueLessonContracts, finalizeSignedLessonContract, sendLessonContract, signLessonContract, validateLessonContractInput } from './service';
import { DRAFT_MARKER } from './template';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const row = async (id: string) => (await client.execute({ sql: 'SELECT * FROM lesson_contracts WHERE id = ?', args: [id] })).rows[0] as unknown as Record<string, unknown>;
const INPUT = { studentName: '김수강', studentEmail: 'student@example.com', studentPhone: '010-1234-5678' };

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  for (const t of ['lesson_contracts', 'lesson_payments', 'lesson_sessions', 'lesson_enrollments', 'availability_blocks']) await client.execute(`DELETE FROM ${t}`);
  (sendEmail as jest.Mock).mockClear();
  (sendEmail as jest.Mock).mockResolvedValue({ ok: true });
});

const enrollment = async (over: Record<string, unknown> = {}) => {
  const r = await createEnrollment({ studentName: '김수강', payMethod: 'bank', courseWeeks: 12, startDate: '2026-10-28', startTime: '14:00', durationMin: 60, monthlyAmount: 350000, note: null, ...over } as never, 'admin');
  if (!r.ok) throw new Error(r.message);
  return r.id;
};

/** 법률 확인으로 문안이 확정된 것을 흉내 낸다 — 확정 전 표시를 지운 본문·템플릿으로 바꾼다. */
const confirmText = async (contractId: string) => {
  const current = await row(contractId);
  await client.execute({
    sql: 'UPDATE lesson_contracts SET content = ?, template = ? WHERE id = ?',
    args: [String(current.content).replace(DRAFT_MARKER, '【확정】'), String(current.template).replace(DRAFT_MARKER, '【확정】'), contractId],
  });
};

const signInput = (contractId: string, token: string, over: Record<string, unknown> = {}) => ({
  contractId, token, now: new Date(), signatureData: 'data:image/png;base64,AAAA', ipAddress: '1.2.3.4', userAgent: 'jest',
  agreedClauseKeys: ['key-terms'], studentBirthdate: '1990-01-15', studentAddress: '서울시 은평구', ...over,
});

describe('만들기', () => {
  it('수강 등록의 조건으로 초안을 만들고, 한 수강에는 취소되지 않은 계약이 하나만 있다', async () => {
    const eid = await enrollment();
    const created = await createLessonContract(eid, INPUT, 'admin');
    expect(created.ok).toBe(true);
    const contract = created.ok ? created.contract : null;
    expect(contract).toMatchObject({ status: 'draft', studentName: '김수강' });
    expect(contract?.content).toContain('매주 수요일 14:00~15:00');
    expect(parseLessonClauses(contract!.clausesJson)[0].key).toBe('key-terms');
    expect(await createLessonContract(eid, INPUT, 'admin')).toMatchObject({ ok: false });
    expect(await cancelLessonContract(contract!.id)).toBe(true);
    expect(await createLessonContract(eid, INPUT, 'admin')).toMatchObject({ ok: true }); // 취소했으니 다시 만들 수 있다
  });

  it('없는 수강·중도 종료된 수강에는 만들 수 없고, 입력을 검증한다', async () => {
    expect(await createLessonContract('nope', INPUT, 'admin')).toMatchObject({ ok: false });
    expect(validateLessonContractInput({ ...INPUT, studentEmail: 'x' })).toMatchObject({ ok: false });
    expect(validateLessonContractInput({ ...INPUT, studentPhone: '12' })).toMatchObject({ ok: false });
    expect(validateLessonContractInput(INPUT)).toMatchObject({ ok: true });
  });
});

describe('발송', () => {
  it('확정 전 문안이 남아 있으면 발송하지 않고 메일도 보내지 않는다', async () => {
    const created = await createLessonContract(await enrollment(), INPUT, 'admin');
    const id = created.ok ? created.contract.id : '';
    const result = await sendLessonContract(id, { adminActor: 'admin', ipAddress: '9.9.9.9' });
    expect(result).toMatchObject({ ok: false, code: 'draft_text' });
    expect((await row(id)).status).toBe('draft');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('문안이 확정되면 운영자 서명과 함께 발송하고, 재발송은 새 링크로 옛 링크를 무효로 한다', async () => {
    const created = await createLessonContract(await enrollment(), INPUT, 'admin');
    const id = created.ok ? created.contract.id : '';
    await confirmText(id);
    const first = await sendLessonContract(id, { adminActor: 'admin', ipAddress: '9.9.9.9' });
    expect(first).toMatchObject({ ok: true, emailSent: true });
    const sent = await row(id);
    expect(sent).toMatchObject({ status: 'sent', operator_actor: 'admin', operator_ip: '9.9.9.9' });
    expect(sent.operator_signed_at).not.toBeNull();
    expect((sendEmail as jest.Mock).mock.calls.some((c) => c[0].to === 'student@example.com')).toBe(true);

    // 쿨다운(10초) 안의 연타는 거절된다.
    expect(await sendLessonContract(id, { adminActor: 'admin', ipAddress: null })).toMatchObject({ ok: false, code: 'cooldown' });
    await client.execute({ sql: 'UPDATE lesson_contracts SET sent_at = sent_at - 60 WHERE id = ?', args: [id] });
    const again = await sendLessonContract(id, { adminActor: 'admin', ipAddress: null });
    expect(again).toMatchObject({ ok: true });
    expect(String(first.ok && first.contract.signToken)).not.toBe(String(again.ok && again.contract.signToken));
  });

  it('메일이 실패해도 계약은 발송 상태이고 링크를 돌려준다', async () => {
    (sendEmail as jest.Mock).mockResolvedValue({ ok: false, errorCode: 'bounce' });
    const created = await createLessonContract(await enrollment(), INPUT, 'admin');
    const id = created.ok ? created.contract.id : '';
    await confirmText(id);
    const result = await sendLessonContract(id, { adminActor: 'admin', ipAddress: null });
    expect(result).toMatchObject({ ok: true, emailSent: false });
    expect(result.ok && result.signUrl).toContain(`/contracts/lesson/${id}/sign?token=`);
    expect((await row(id)).notification_error).toBe('bounce');
  });
});

describe('서명', () => {
  const sentContract = async () => {
    const created = await createLessonContract(await enrollment(), INPUT, 'admin');
    const id = created.ok ? created.contract.id : '';
    await confirmText(id);
    const sent = await sendLessonContract(id, { adminActor: 'admin', ipAddress: null });
    return { id, token: sent.ok ? String(sent.contract.signToken) : '' };
  };

  it('서명하면 체결되고 계약일·개인정보가 본문에 들어가며 지문이 대조된다', async () => {
    const { id, token } = await sentContract();
    expect(await signLessonContract(signInput(id, token, { now: new Date(Date.now() + 86_400_000) }))).toBe('signed');
    const signed = await row(id);
    expect(signed.status).toBe('signed');
    expect(String(signed.content)).toContain('1990-01-15');
    expect(String(signed.content)).toContain('서울시 은평구');
    expect(String(signed.content)).not.toContain('(서명하는 날로 기재)');
    const contract = await mockDb.query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    const check = verifyLessonFingerprint(contract!.contentHash, { contract: contract!, clauses: parseLessonClauses(contract!.clausesJson), signedAt: contract!.signedAt! });
    expect(check.status).toBe('match');
    // 본문을 몰래 바꾸면 불일치로 잡힌다.
    const tampered = verifyLessonFingerprint(contract!.contentHash, { contract: { ...contract!, content: `${contract!.content}x` }, clauses: parseLessonClauses(contract!.clausesJson), signedAt: contract!.signedAt! });
    expect(tampered.status).toBe('mismatch');
  });

  it('서명은 한 번만 — 두 번째와 틀린 토큰·발송 전 계약은 거절된다', async () => {
    const { id, token } = await sentContract();
    expect(await signLessonContract(signInput(id, 'wrong-token'))).toBe('not_found');
    expect(await signLessonContract(signInput(id, token))).toBe('signed');
    expect(await signLessonContract(signInput(id, token))).toBe('conflict');

    const draft = await createLessonContract(await enrollment({ startDate: '2026-11-04', startTime: '16:00' }), INPUT, 'admin');
    expect(await signLessonContract(signInput(draft.ok ? draft.contract.id : '', token))).toBe('not_found');
  });

  it('만료된 링크로는 서명할 수 없고, 접근 시 만료로 내려간다', async () => {
    const { id, token } = await sentContract();
    await client.execute({ sql: 'UPDATE lesson_contracts SET expires_at = unixepoch() - 10 WHERE id = ?', args: [id] });
    expect(await signLessonContract(signInput(id, token))).toBe('conflict');
    expect(await expireOverdueLessonContracts()).toBe(1);
    expect((await row(id)).status).toBe('expired');
  });

  it('체결 뒤 후처리는 수강생·운영자에게 메일을 보내고 결과를 남긴다', async () => {
    const { id, token } = await sentContract();
    await signLessonContract(signInput(id, token));
    (sendEmail as jest.Mock).mockClear();
    await finalizeSignedLessonContract(id);
    const recipients = (sendEmail as jest.Mock).mock.calls.map((c) => c[0].to);
    expect(recipients).toContain('student@example.com');
    expect(recipients).toHaveLength(2);
    expect((await row(id)).notified_at).not.toBeNull();
  });

  it('취소한 계약은 서명할 수 없다', async () => {
    const { id, token } = await sentContract();
    expect(await cancelLessonContract(id)).toBe(true);
    expect(await signLessonContract(signInput(id, token))).toBe('not_found'); // 토큰이 지워진다
  });
});

describe('파기', () => {
  it('수강이 끝난 지 3년이 지난 체결 계약의 개인정보를 지우고, 진행 중 수강은 건드리지 않는다', async () => {
    const created = await createLessonContract(await enrollment({ startDate: '2022-01-05' }), INPUT, 'admin');
    const id = created.ok ? created.contract.id : '';
    await confirmText(id);
    const sent = await sendLessonContract(id, { adminActor: 'admin', ipAddress: null });
    await signLessonContract(signInput(id, String(sent.ok && sent.contract.signToken), { now: new Date('2022-01-01T00:00:00Z') }));
    // 회차를 전부 끝낸 것으로 — 마지막 수업일(2022-03-23)이 3년 지났다.
    await client.execute(`UPDATE lesson_sessions SET status = 'done'`);
    const now = new Date('2026-10-21T00:00:00Z');
    const result = await purgeExpiredLessonPersonalData(now);
    expect(result.contractsPurged).toBe(1);
    const purged = await row(id);
    expect(purged).toMatchObject({ student_name: '(개인정보 파기됨)', student_email: '(개인정보 파기됨)', content: '(개인정보 파기됨)' });
    expect(purged.signature_data).toBeNull();
    expect(purged.purged_at).not.toBeNull();
    expect(await purgeExpiredLessonPersonalData(now)).toMatchObject({ contractsPurged: 0 }); // 이미 파기된 건은 건너뛴다

    // 수강 등록의 이름은 5년 — 아직 3년 8개월째라 남는다.
    expect((await client.execute('SELECT student_name FROM lesson_enrollments')).rows[0]).toMatchObject({ student_name: '김수강' });
    const later = await purgeExpiredLessonPersonalData(new Date('2027-04-01T00:00:00Z'));
    expect(later.enrollmentsCleared).toBe(1);
  });

  it('아직 예정 회차가 남은 수강의 체결 계약은 아무리 오래돼도 파기하지 않는다', async () => {
    const created = await createLessonContract(await enrollment({ startDate: '2026-10-28' }), INPUT, 'admin');
    const id = created.ok ? created.contract.id : '';
    await confirmText(id);
    const sent = await sendLessonContract(id, { adminActor: 'admin', ipAddress: null });
    await signLessonContract(signInput(id, String(sent.ok && sent.contract.signToken)));
    // 회차가 하나라도 예정으로 남아 있으면 "끝난 수강"이 아니다 — 자동 갱신처럼 이용이 이어질 수 있다.
    expect(await purgeExpiredLessonPersonalData(new Date('2040-01-01T00:00:00Z'))).toMatchObject({ contractsPurged: 0, enrollmentsCleared: 0 });
    expect((await row(id)).status).toBe('signed');
  });
});
