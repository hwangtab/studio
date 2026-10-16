/** @jest-environment node */

/**
 * 상점·공연 정산 알림 메일(P3)과 정산 CSV — 실제 SQLite(in-memory, 마이그레이션 전부 적용)로 고정한다.
 * 지키려는 것: ① 메일에는 마스킹된 계좌(은행·예금주·뒤 4자리)만, 계좌번호 전체는 어디에도 없다 ② 메모는 지급 완료 메일에만
 * ③ 플레이스홀더 주소·계정 없는 수취인에게는 보내지 않는다 ④ 발송 실패는 던지지 않고 warnings + 운영자 폴백 ⑤ 계좌를 연 일이 접속기록에 남는다
 * ⑥ CSV에는 민감 칸이 없고 수식 인젝션이 막혀 있다 ⑦ 내려받은 사실이 성공·오류 모두 접속기록에 남는다.
 */
import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { fundingCreators, partnerPayouts, privacyAccessLogs } from '../../db/schema';
import { FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
import { encryptPayoutAccount } from '../funding/payoutAccountCrypto';
import { MANUAL_PLACEHOLDER_EMAIL } from '../privacy/manualPlaceholder';

let testDb: ShowsTestDb;
let dbThrows = false;
jest.mock('../../db/client', () => ({
  getDb: () => {
    if (dbThrows) throw new Error('DB 장애');
    return testDb;
  },
}));
const sendEmail = jest.fn();
jest.mock('../email/resend', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));
jest.mock('../contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';

import exportHandler from '../../pages/api/admin/partner-payouts/export';
import { authenticateAdminApi } from '../contracts/admin-auth';
import { sendPartnerPayoutNotice } from './notify';
import { PARTNER_PAYOUT_EXPORT_COLUMNS, validatePartnerPayoutRange } from './export';
/* eslint-enable import/first */

const ACCOUNT_NUMBER = '110-123-456789';
const RESIDENT_NUMBER = '9901011234567';
const REQ = { headers: {}, socket: {} } as never;

let previousKey: string | undefined;
let errorSpy: jest.SpyInstance;

beforeEach(async () => {
  ({ db: testDb } = await createTestDb());
  dbThrows = false;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ ok: true });
  previousKey = process.env[FIELD_CRYPTO_KEY_ENV];
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 7).toString('base64');
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (authenticateAdminApi as jest.Mock).mockReset().mockResolvedValue({ ok: true, actor: 'kyungha' });
});

afterEach(() => {
  errorSpy.mockRestore();
  if (previousKey === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = previousKey;
});

const seedCreator = (over: Partial<typeof fundingCreators.$inferInsert> = {}) =>
  testDb.insert(fundingCreators).values({
    id: 'c1', email: 'artist@example.com', name: '이름', taxType: 'withholding',
    payoutAccountEnc: encryptPayoutAccount({ bankName: '국민은행', account: ACCOUNT_NUMBER, holder: '홍길동' }),
    payoutAccountLast4: '6789', residentNumberEnc: `enc-${RESIDENT_NUMBER}`, ...over,
  });

const seedPayout = (over: Partial<typeof partnerPayouts.$inferInsert> = {}) =>
  testDb.insert(partnerPayouts).values({
    id: 'p1', kind: 'shop', subjectKey: 'creator:c1', period: '2026-10', creatorId: 'c1', payeeName: '홍길동', taxType: 'withholding',
    grossAmount: 100000, studioAmount: 45000, vatDeductionAmount: 5000, shareAmount: 55000, withholdingAmount: 1650,
    adjustmentAmount: -3000, netAmount: 45350, itemCount: 4, status: 'pending', ...over,
  });

const accessLogs = () => testDb.select().from(privacyAccessLogs);

describe('sendPartnerPayoutNotice', () => {
  it('정산 기록 메일 — 마스킹된 계좌만 싣고 계좌번호 전체·주민번호는 어디에도 없다', async () => {
    await seedCreator();
    await seedPayout({ memo: '내부 메모' });
    const warnings = await sendPartnerPayoutNotice('p1', 'recorded', { req: REQ, actor: 'kyungha' });
    expect(warnings).toEqual([]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0] as { to: string; subject: string; text: string; html: string };
    expect(mail.to).toBe('artist@example.com');
    expect(mail.subject).toContain('정산 내역을 알려 드려요');
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('국민은행 홍길동');
      expect(body).toContain('6789');
      expect(body).not.toContain(ACCOUNT_NUMBER);
      expect(body).not.toContain('123456789');
      expect(body).not.toContain(RESIDENT_NUMBER);
      expect(body).toContain('45,350원');
      // 기록 메일에는 메모를 싣지 않는다 — 메모는 이체 뒤 지급 완료 때 쓰이는 칸이다.
      expect(body).not.toContain('내부 메모');
    }
  });

  it('지급 완료 메일 — 메모를 싣고 사용자 입력은 HTML에서 escape된다', async () => {
    await seedCreator();
    await seedPayout({ status: 'paid', memo: '10/20 이체 <b>완료</b>' });
    await sendPartnerPayoutNotice('p1', 'paid', { req: REQ, actor: 'kyungha' });
    const mail = sendEmail.mock.calls[0][0] as { subject: string; text: string; html: string };
    expect(mail.subject).toContain('정산금을 보냈어요');
    expect(mail.text).toContain('메모: 10/20 이체 <b>완료</b>');
    expect(mail.html).toContain('10/20 이체 &lt;b&gt;완료&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>완료</b>');
  });

  it('계좌를 연 일을 새 행위 이름으로 정산 기록 id와 함께 접속기록에 남긴다 — 값은 적지 않는다', async () => {
    await seedCreator();
    await seedPayout();
    await sendPartnerPayoutNotice('p1', 'recorded', { req: REQ, actor: 'kyungha' });
    const logs = await accessLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'partner_payout_account_email', targetId: 'p1', result: 'success', actor: 'kyungha' });
    expect(JSON.stringify(logs[0])).not.toContain('국민은행');
    expect(JSON.stringify(logs[0])).not.toContain('6789');
  });

  it('복호화 실패는 decrypt_failed로 남기고 메일은 뒤 4자리만 싣고 나간다', async () => {
    await seedCreator({ payoutAccountEnc: 'v2:broken:payload' });
    await seedPayout();
    const warnings = await sendPartnerPayoutNotice('p1', 'recorded', { req: REQ, actor: 'kyungha' });
    expect(warnings).toEqual([]);
    expect((await accessLogs())[0].result).toBe('decrypt_failed');
    const mail = sendEmail.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain('6789');
    expect(mail.text).not.toContain('국민은행');
  });

  it('수기 등록 플레이스홀더 주소에는 보내지 않고 직접 알리라는 경고만 돌려준다', async () => {
    await seedCreator({ email: MANUAL_PLACEHOLDER_EMAIL });
    await seedPayout();
    const warnings = await sendPartnerPayoutNotice('p1', 'recorded', { req: REQ, actor: 'kyungha' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('직접 알려');
    expect(await accessLogs()).toHaveLength(0); // 계좌를 열지도 않았다
  });

  it('계정이 없는 수취인(상점 파일 갈래)에게는 보내지 않는다', async () => {
    await seedPayout({ subjectKey: 'file:fa', creatorId: null });
    const warnings = await sendPartnerPayoutNotice('p1', 'paid', { req: REQ, actor: 'kyungha' });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(warnings[0]).toContain('계정이 없는');
  });

  it('수취인 메일이 실패해도 던지지 않는다 — warnings를 돌려주고 운영자 폴백을 보낸다', async () => {
    await seedCreator();
    await seedPayout();
    sendEmail.mockResolvedValueOnce({ ok: false, errorCode: 'rate_limited' }).mockResolvedValueOnce({ ok: true });
    const warnings = await sendPartnerPayoutNotice('p1', 'recorded', { req: REQ, actor: 'kyungha' });
    expect(warnings.some((w) => w.includes('rate_limited'))).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const fallback = sendEmail.mock.calls[1][0] as { to: string; subject: string; text: string };
    expect(fallback.to).not.toBe('artist@example.com');
    expect(fallback.subject).toContain('알림 메일 발송 실패');
    expect(fallback.text).toContain('artist@example.com');
    expect(fallback.text).not.toContain(ACCOUNT_NUMBER);
  });

  it('폴백까지 실패하면 그 사실도 warnings에 싣는다', async () => {
    await seedCreator();
    await seedPayout();
    sendEmail.mockResolvedValue({ ok: false, errorCode: 'down' });
    const warnings = await sendPartnerPayoutNotice('p1', 'paid', { req: REQ, actor: 'kyungha' });
    expect(warnings.some((w) => w.includes('운영자 폴백 알림도 실패'))).toBe(true);
  });

  it('DB 오류 등 예외도 삼켜 warnings로 올린다 — 기록·지급 응답을 500으로 만들지 않는다', async () => {
    dbThrows = true;
    const warnings = await sendPartnerPayoutNotice('p1', 'recorded', { req: REQ, actor: 'kyungha' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('직접 알려');
  });

  it('공연 정산도 같은 진입점으로 나간다 — 수수료 줄이 있고 상점 전용 줄은 없다', async () => {
    await seedCreator();
    await seedPayout({
      id: 'p2', kind: 'show', subjectKey: 'show-1', period: 'all', studioAmount: 0, platformFeeAmount: 5500, paymentFeeAmount: 3300,
      vatDeductionAmount: 0, withholdingAmount: 0, adjustmentAmount: 0, netAmount: 91200,
    });
    await sendPartnerPayoutNotice('p2', 'recorded', { req: REQ, actor: 'kyungha' });
    const mail = sendEmail.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain('플랫폼 수수료');
    expect(mail.text).toContain('결제 수수료');
    expect(mail.text).not.toContain('스튜디오 몫');
  });
});

describe('정산 CSV', () => {
  const call = async (query: Record<string, string>, method = 'GET') => {
    const send = jest.fn();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ send, json });
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => { headers[k] = v; }, status } as unknown as NextApiResponse;
    await exportHandler({ method, query, headers: {}, socket: {} } as unknown as NextApiRequest, res);
    return { status: status.mock.calls[0][0] as number, send, json, headers };
  };

  it('기간 검증 — 형식·순서·24개월 상한', () => {
    expect(validatePartnerPayoutRange({ from: '2026-10', to: '2026-10' })).toBeNull();
    expect(validatePartnerPayoutRange({ from: '2024-11', to: '2026-10' })).toBeNull(); // 정확히 24개월
    expect(validatePartnerPayoutRange({ from: '2024-10', to: '2026-10' })).toContain('24개월');
    expect(validatePartnerPayoutRange({ from: '2026-11', to: '2026-10' })).toContain('앞설 수 없');
    expect(validatePartnerPayoutRange({ from: '2026-13', to: '2026-13' })).toContain('YYYY-MM');
    expect(validatePartnerPayoutRange({ from: '2026-10-01', to: '2026-10-31' })).toContain('YYYY-MM');
  });

  it('인증이 없으면 401 — 조회도 접속기록도 하지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    const r = await call({ from: '2026-10', to: '2026-10' });
    expect(r.status).toBe(401);
    expect(await accessLogs()).toHaveLength(0);
  });

  it('잘못된 기간·kind는 400이고 접속기록을 남기지 않는다', async () => {
    expect((await call({ from: '2026-10', to: '2026-09' })).status).toBe(400);
    expect((await call({ from: '2026-10', to: '2026-10', kind: 'x' })).status).toBe(400);
    expect((await call({ from: '2026-10', to: '2026-10' }, 'POST')).status).toBe(405);
    expect(await accessLogs()).toHaveLength(0);
  });

  it('열 목록이 고정이고 민감 칸이 없다 — 번호·계좌·이메일·연락처 값이 파일 어디에도 없다', async () => {
    await seedCreator();
    await seedPayout({ memo: '=HYPERLINK("http://x")', payeeName: '홍,길동' });
    await seedPayout({
      id: 'p2', kind: 'show', subjectKey: 'show-1', period: 'all', studioAmount: 0, platformFeeAmount: 5500, paymentFeeAmount: 3300,
      netAmount: 91200, status: 'paid', paidAt: new Date('2026-11-03T15:30:00Z'), createdAt: new Date('2026-10-20T01:00:00Z'),
    });
    const r = await call({ from: '2026-10', to: '2026-10' });
    expect(r.status).toBe(200);
    expect(r.headers['Content-Type']).toContain('text/csv');
    expect(r.headers['Cache-Control']).toBe('no-store');
    const csv = r.send.mock.calls[0][0] as string;
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe(PARTNER_PAYOUT_EXPORT_COLUMNS.join(','));
    expect(lines).toHaveLength(3);
    // 금액·상태·수식 방어·쉼표 이스케이프
    expect(csv).toContain('"홍,길동"');
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain('개인(원천징수)');
    expect(csv).toContain('지급 완료');
    expect(csv).toContain('2026-11-04'); // 지급일은 KST 날짜
    // 민감 정보 부재 — 열 이름과 값 둘 다
    for (const forbidden of ['주민', '계좌', '이메일', '연락처', '전화', 'artist@example.com', ACCOUNT_NUMBER, '6789', RESIDENT_NUMBER, 'enc-', 'creator:c1', 'c1']) {
      expect(csv).not.toContain(forbidden);
    }
    // 기록 행: 성공 + 행 수만, 값은 없음
    const logs = await accessLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'partner_payout_export', result: 'success', rowCount: 2, targetId: 'all_2026-10_2026-10' });
    expect(JSON.stringify(logs[0])).not.toContain('홍');
  });

  it('kind·기간으로 거른다 — 상점은 정산 달, 공연은 기록한 달(KST) 기준', async () => {
    await seedCreator();
    await seedPayout({ id: 'a', period: '2026-09', subjectKey: 'creator:c1' });
    await seedPayout({ id: 'b', period: '2026-10', subjectKey: 'creator:c2' });
    await seedPayout({ id: 'c', kind: 'show', subjectKey: 'show-1', period: 'all', createdAt: new Date('2026-09-30T16:00:00Z') }); // KST 10-01 01:00
    await seedPayout({ id: 'd', kind: 'show', subjectKey: 'show-2', period: 'all', createdAt: new Date('2026-09-30T14:00:00Z') }); // KST 09-30
    const shop = await call({ kind: 'shop', from: '2026-10', to: '2026-10' });
    expect((shop.send.mock.calls[0][0] as string).trim().split('\r\n')).toHaveLength(2);
    const show = await call({ kind: 'show', from: '2026-10', to: '2026-10' });
    const showCsv = show.send.mock.calls[0][0] as string;
    expect(showCsv).toContain('공연 show-1');
    expect(showCsv).not.toContain('공연 show-2');
    const all = await call({ from: '2026-09', to: '2026-10' });
    expect((all.send.mock.calls[0][0] as string).trim().split('\r\n')).toHaveLength(5);
  });

  it('조회가 실패하면 500이고 접속기록에 error를 남긴다', async () => {
    await testDb.run(sql`DROP TABLE partner_payouts`);
    const r = await call({ from: '2026-10', to: '2026-10' });
    expect(r.status).toBe(500);
    const logs = await accessLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'partner_payout_export', result: 'error', rowCount: null });
  });
});

it('시드 헬퍼 sanity — 테스트 DB에 개설자가 들어간다', async () => {
  await seedCreator();
  const [row] = await testDb.select().from(fundingCreators).where(eq(fundingCreators.id, 'c1'));
  expect(row.email).toBe('artist@example.com');
});
