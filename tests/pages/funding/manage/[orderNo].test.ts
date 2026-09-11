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
import { createFundingPledge, findFundingOrderByOrderNo } from '../../../../lib/funding/service';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from '../../../../lib/funding/validation';

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
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
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
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
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
    const c = await createFundingPledge(payloadFor({ displayNamePublic: true }), PROJECT, reward('mail'), NOW);
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
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
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
