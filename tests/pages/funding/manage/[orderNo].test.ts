/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/funding/projects', () => ({ ...jest.requireActual('../../../../lib/funding/projects'), getFundingProject: () => PROJECT }));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/[locale]/funding/manage/[orderNo]';
// eslint-disable-next-line import/first
import { findFundingOrderByOrderNo } from '../../../../lib/funding/service';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';
// eslint-disable-next-line import/first
import type { LegacyPledgePayload as CreatePledgePayload } from '../../../../test-utils/fundingPledge';
import { createSingleRewardPledge } from '../../../../test-utils/fundingPledge';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const PROJECT = parseFundingProject(`---
slug: demo
title: 데모
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 1
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
    downloads:
      - label: MP3 320kbps
        key: demo/album-mp3.zip
      - label: WAV 24bit 96kHz
        key: demo/album-wav.zip
---
`, 'demo');

const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});
const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

const markPaid = async (orderNo: string) => {
  const o = await findFundingOrderByOrderNo(orderNo);
  await client.execute({ sql: "UPDATE orders SET status='paid' WHERE id=?", args: [o!.id] });
};

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => client.close());

describe('funding manage getServerSideProps', () => {
  it('토큰 없음 → notFound', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', orderNo: 'FND-XXXX' }, query: {}, res,
    } as never);
    expect(result).toEqual({ notFound: true });
    expect(res.setHeader).toHaveBeenCalled();
  });

  it('토큰 불일치 → notFound', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaid(c.orderNo);
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', orderNo: c.orderNo }, query: { token: 'wrong-token' }, res,
    } as never);
    expect(result).toEqual({ notFound: true });
  });

  it('주문 부재 → notFound', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', orderNo: 'FND-NOPE' }, query: { token: 'anything' }, res,
    } as never);
    expect(result).toEqual({ notFound: true });
  });

  it('비-ko locale → /ko/funding redirect', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'en', orderNo: 'FND-XXXX' }, query: { token: 't' }, res,
    } as never);
    expect(result).toEqual({ redirect: { destination: '/ko/funding', permanent: false } });
  });

  it('정상 토큰 → props에 manageToken은 없고 쿼리 token만 echo, 상태·금액이 맞다', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaid(c.orderNo);
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko', orderNo: c.orderNo }, query: { token: c.manageToken }, res,
    } as never);
    if (!('props' in result)) throw new Error('props 기대');
    const props = await result.props;
    expect(props).not.toHaveProperty('manageToken');
    expect(props.token).toBe(c.manageToken);
    expect(props.orderNo).toBe(c.orderNo);
    expect(props.status).toBe('paid');
    expect(props.totalAmount).toBe(5000);
    expect(props.projectTitle).toBe('데모');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('no-store'));
  });

  // 약관 제13조 2항이 약속한 철회 UI의 입력값 — 공개 여부와 "지금 바꿀 수 있는지"가 함께 와야 한다.
  it('이름 공개 동의 여부와 편집 가능 여부를 함께 넘긴다', async () => {
    const c = await createSingleRewardPledge(payloadFor({ displayNamePublic: true }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaid(c.orderNo);
    const result = await getServerSideProps({
      params: { locale: 'ko', orderNo: c.orderNo }, query: { token: c.manageToken }, res: resStub(),
    } as never);
    if (!('props' in result)) throw new Error('props 기대');
    const props = await result.props;
    expect(props.displayNamePublic).toBe(true);
    expect(props.canEditDisplayName).toBe(true);
  });

  it('환불 완료 건은 이름 공개 설정을 바꿀 수 없다', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    const o = await findFundingOrderByOrderNo(c.orderNo);
    await client.execute({ sql: "UPDATE orders SET status='refunded' WHERE id=?", args: [o!.id] });
    const result = await getServerSideProps({
      params: { locale: 'ko', orderNo: c.orderNo }, query: { token: c.manageToken }, res: resStub(),
    } as never);
    if (!('props' in result)) throw new Error('props 기대');
    expect((await result.props).canEditDisplayName).toBe(false);
  });
});

/**
 * 이 한 줄(SSR이 `assessSelfCancel`에 `paymentMethod`를 넘기는 것)이 빠져서 죽은 취소
 * 버튼이 났다(PR #77). 계좌 입금이 돌아오면서 `entrySource`까지 넘겨야 한다 — 같은 `bank_transfer`라도
 * 관리자 수기 등록은 문의로, 온라인 계좌 입금은 환불 계좌를 받아 화면에서 취소한다.
 * 판정 자체는 policy.test.ts가 덮고, 여기서는 **배선**을 고정한다.
 */
describe('SSR이 셀프 취소 판정에 결제수단·등록 경로를 넘긴다', () => {
  const setPledge = (orderNo: string, set: string) => client.execute({
    sql: `UPDATE funding_pledges SET ${set} WHERE order_id=(SELECT id FROM orders WHERE order_no=?)`,
    args: [orderNo],
  });
  const propsOf = async (orderNo: string, token: string) =>
    ((await getServerSideProps({
      params: { locale: 'ko', orderNo }, query: { token }, res: resStub(),
    } as never)) as { props: { canCancel: boolean; cancelBlockedReason: string | null; refundVia: string | null; deposit: { amount: number; deadline: string; customerName: string } | null; onlineBankTransfer: boolean } }).props;

  it('관리자 수기 등록(계좌)은 canCancel=false + 문의 안내를 내려보낸다', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaid(c.orderNo);
    await setPledge(c.orderNo, "payment_method='bank_transfer', entry_source='manual'");

    const props = await propsOf(c.orderNo, c.manageToken);
    expect(props.canCancel).toBe(false);
    expect(props.refundVia).toBeNull();
    expect(props.cancelBlockedReason).toContain('문의로 접수');
  });

  // 온라인 계좌 입금은 결제수단 때문에 막히지 않는다. canCancel 자체는 프로젝트 진행 상태(실시간
  // 기준)에 좌우되므로, 취소가 열려 있으면 환불 경로가 계좌인지를 본다.
  it('온라인 계좌 입금은 offline_payment로 막히지 않고, 열리면 환불 계좌 경로다', async () => {
    const c = await createSingleRewardPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaid(c.orderNo);

    const props = await propsOf(c.orderNo, c.manageToken);
    expect(props.cancelBlockedReason ?? '').not.toContain('운영자가 직접 등록');
    if (props.canCancel) expect(props.refundVia).toBe('bank_account');
    expect(props.onlineBankTransfer).toBe(true);
    expect(props.deposit).toBeNull();
  });

  it('토스 펀딩은 결제수단 때문에 막히지 않는다', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaid(c.orderNo);

    const props = await propsOf(c.orderNo, c.manageToken);
    expect(props.cancelBlockedReason ?? '').not.toContain('운영자가 직접 등록');
    if (props.canCancel) expect(props.refundVia).toBe('card');
  });

  it('입금 대기 중인 계좌 입금은 계좌 안내 값(금액·기한·이름)을 서버 값으로 내려보낸다', async () => {
    const c = await createSingleRewardPledge(payloadFor({ paymentMethod: 'bank_transfer', additionalAmount: 2000 }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();

    const props = await propsOf(c.orderNo, c.manageToken);
    expect(props.deposit).toEqual({ amount: 7000, deadline: c.holdExpiresAt.toISOString(), customerName: '김후원' });
    // 기한은 신청 시각 + 3일이다(안내용 — 자동 취소 없음).
    expect(new Date(props.deposit!.deadline).getTime() - NOW.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('기한이 지나도 입금 대기면 계좌 안내를 그대로 내려보낸다 — 자동 만료가 없다', async () => {
    const c = await createSingleRewardPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    // SSR은 진입 시 expireStalePledges를 돈다. 기한을 과거로 돌려 두어도 계좌 입금은 건너뛰어야 한다.
    await setPledge(c.orderNo, 'hold_expires_at = 1000');

    const props = await propsOf(c.orderNo, c.manageToken);
    expect(props.deposit).not.toBeNull();
  });

  it('취소(환불)를 요청한 계좌 입금 건에는 내려받기 주소를 내려보내지 않는다 — 송금 전까지 paid여도', async () => {
    const c = await createSingleRewardPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaid(c.orderNo);
    const before = (await getServerSideProps({ params: { locale: 'ko', orderNo: c.orderNo }, query: { token: c.manageToken }, res: resStub() } as never)) as { props: { downloads: unknown[] } };
    expect(before.props.downloads.length).toBeGreaterThan(0);
    await setPledge(c.orderNo, 'refund_requested_at = unixepoch()');
    const after = (await getServerSideProps({ params: { locale: 'ko', orderNo: c.orderNo }, query: { token: c.manageToken }, res: resStub() } as never)) as { props: { downloads: unknown[] } };
    expect(after.props.downloads).toEqual([]);
  });

  it('토스 결제 대기에는 계좌 안내가 없다', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    const props = await propsOf(c.orderNo, c.manageToken);
    expect(props.deposit).toBeNull();
    expect(props.onlineBankTransfer).toBe(false);
  });
});


/**
 * 디지털 리워드 내려받기 주소는 **결제가 살아 있는 건에만** 내려보낸다.
 *
 * 환불·만료된 건에 링크가 남으면 돈을 돌려받고도 리워드를 계속 받는 화면이 된다. 관리
 * 토큰은 취소 뒤에도 유효하므로(취소 결과를 확인해야 한다) 링크를 지우는 판정이 서버에
 * 있어야 한다. 화면은 서버가 준 값을 그대로 렌더할 뿐이다.
 */
describe('음원 내려받기 키는 결제가 살아 있을 때만 내려간다', () => {
  const propsFor = async (orderNo: string, token: string) =>
    ((await getServerSideProps({
      params: { locale: 'ko', orderNo }, query: { token }, res: resStub(),
    } as never)) as { props: { downloads: Array<{ label: string; key: string }> } }).props;

  it('결제 확정 건에는 주소가 내려간다 — 리워드에 걸린 파일을 전부', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaid(c.orderNo);
    // 상위 티어는 하위 티어가 주는 것을 포함한다. 한 줄만 내려가면 약속한 것을 덜 주게 된다.
    expect((await propsFor(c.orderNo, c.manageToken)).downloads).toEqual([
      { label: 'MP3 320kbps', key: 'demo/album-mp3.zip' },
      { label: 'WAV 24bit 96kHz', key: 'demo/album-wav.zip' },
    ]);
  });

  it('환불된 건에는 주소를 내려보내지 않는다', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    await markPaid(c.orderNo);
    await client.execute({ sql: "UPDATE orders SET status='refunded' WHERE order_no=?", args: [c.orderNo] });
    expect((await propsFor(c.orderNo, c.manageToken)).downloads).toEqual([]);
  });

  it('결제 전(pending) 건에도 내려보내지 않는다', async () => {
    const c = await createSingleRewardPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    expect((await propsFor(c.orderNo, c.manageToken)).downloads).toEqual([]);
  });
});
