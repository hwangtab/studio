/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { aggregateProjectStatus, createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import { FUNDING_TERMS_VERSION } from './policy';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

export const PROJECT = parseFundingProject(`---
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

export const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

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
});
afterAll(() => client.close());

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

describe('createFundingPledge', () => {
  it('주문·후원을 만들고 금액을 서버가 계산한다', async () => {
    const r = await createFundingPledge(payloadFor({ additionalAmount: 1000 }), PROJECT, reward('mail'), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.orderNo).toMatch(/^FND-20261015-[0-9A-F]{8}$/);
    expect(r.amounts.totalAmount).toBe(6000);
    expect(r.holdExpiresAt.getTime()).toBe(NOW.getTime() + 900 * 1000);
    const order = await findFundingOrderByOrderNo(r.orderNo);
    expect(order?.type).toBe('funding');
    expect(order?.fundingPledge?.rewardTitle).toBe('감사 메일');
  });

  // 동의 사실이 행에 남지 않던 시절엔 분쟁이 나면 "그때 무엇에 동의했는가"를 git 이력으로
  // 손수 대조해야 했다. 후원 0건인 지금 컬럼을 넣어 두는 것이 유일한 무비용 시점이었다.
  it('약관 동의 시각과 동의한 판본을 행에 남긴다', async () => {
    const r = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!r.ok) throw new Error();
    const pledge = (await findFundingOrderByOrderNo(r.orderNo))?.fundingPledge;
    expect(pledge?.termsAgreedAt?.getTime()).toBe(NOW.getTime());
    expect(pledge?.termsVersion).toBe(FUNDING_TERMS_VERSION);
    // 후원 생성 시점에는 아직 전달이 없다. 채우는 곳은 관리자 set_fulfillment의
    // 'delivered' 전이뿐이다(tests/api/admin/funding/pledges/setFulfillment.integration.test.ts).
    expect(pledge?.deliveredAt).toBeNull();
  });

  it('한정 수량 1개에 두 번 후원하면 두 번째는 sold_out', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    const first = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'x@example.com' }), PROJECT, reward('cd'), NOW);
    const second = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'y@example.com', customerPhone: '010-9' }), PROJECT, reward('cd'), NOW);
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, code: 'sold_out' });
  });

  // 재고 조건이 paid만 보던 시절엔, 부분환불된 한정 리워드가 재고를 놓아준 것처럼 보여
  // 화면(aggregateProjectStatus 기준 품절)과 서버 판정이 어긋나 초과 판매가 났다.
  it('partially_refunded 후원도 한정 재고를 잡는다 — 다음 후원은 sold_out', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    const first = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'p1@example.com' }), PROJECT, reward('cd'), NOW);
    if (!first.ok) throw new Error();
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [first.orderNo] });
    const second = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'p2@example.com', customerPhone: '010-8' }), PROJECT, reward('cd'), NOW);
    expect(second).toEqual({ ok: false, code: 'sold_out' });
  });

  it('홀드가 지난 pending은 재고를 잡지 않는다', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    await createFundingPledge(payloadFor({ rewardId: 'cd', shipping }), PROJECT, reward('cd'), new Date(NOW.getTime() - 1000 * 1000));
    const later = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'z@example.com', customerPhone: '010-8' }), PROJECT, reward('cd'), NOW);
    expect(later.ok).toBe(true);
  });

  it('자기 주문번호를 증명으로 내면 그 pending을 만료시킨다(자기 홀드 해제)', async () => {
    const a = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW, {
      releaseOrderNo: a.ok ? a.orderNo : null,
    });
    const prev = await findFundingOrderByOrderNo(a.ok ? a.orderNo : '');
    expect(prev?.status).toBe('expired');
  });

  /**
   * 소유 증명이 없으면 아무것도 만료시키지 않는다.
   *
   * 예전엔 조건이 이메일+전화 문자열 일치뿐이었고 둘 다 요청 본문에서 오는 미검증 값이라,
   * 피해자의 연락처를 아는 제3자가 후원 요청 한 번으로 피해자의 pending 주문을 expired로
   * 만들 수 있었다. 피해자는 결제창 인증을 마치고 돌아와 '이미 처리되었거나 만료된
   * 후원입니다'로 거절당하고, 풀린 한정 재고는 공격자의 INSERT가 가져간다.
   */
  it('증명 없이 같은 이메일·전화로 보내면 남의 pending을 건드리지 못한다', async () => {
    const victim = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); // 공격자 — 증명 없음
    const prev = await findFundingOrderByOrderNo(victim.ok ? victim.orderNo : '');
    expect(prev?.status).toBe('pending');
  });

  it('남의 주문번호를 넣어도 이메일·전화가 다르면 만료되지 않는다', async () => {
    const victim = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    await createFundingPledge(
      payloadFor({ customerEmail: 'attacker@example.com', customerPhone: '010-9999-9999' }),
      PROJECT, reward('mail'), NOW,
      { releaseOrderNo: victim.ok ? victim.orderNo : null },
    );
    const prev = await findFundingOrderByOrderNo(victim.ok ? victim.orderNo : '');
    expect(prev?.status).toBe('pending');
  });

  /**
   * 증명을 **가진** 요청도 자기 주문 하나만 만료시킨다. 같은 이메일·전화로 두 건이 열려 있을 때
   * order_no 조건이 없으면 두 건이 함께 만료된다 — 공격자가 자기 주문번호를 증명으로 내고
   * 피해자의 홀드까지 함께 날리는 경로가 그대로 남는다.
   */
  it('증명한 주문 하나만 만료된다 — 같은 연락처의 다른 pending은 살아 있다', async () => {
    const victim = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    const mine = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW, {
      releaseOrderNo: mine.ok ? mine.orderNo : null,
    });
    expect((await findFundingOrderByOrderNo(mine.ok ? mine.orderNo : ''))?.status).toBe('expired');
    expect((await findFundingOrderByOrderNo(victim.ok ? victim.orderNo : ''))?.status).toBe('pending');
  });

  it('다른 프로젝트에 후원해도 이 프로젝트의 기존 pending은 만료시키지 않는다', async () => {
    const a = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    const otherProject = { ...PROJECT, slug: 'other' };
    await createFundingPledge(payloadFor({ projectSlug: 'other' }), otherProject, reward('mail'), NOW, {
      releaseOrderNo: a.ok ? a.orderNo : null,
    });
    const prev = await findFundingOrderByOrderNo(a.ok ? a.orderNo : '');
    expect(prev?.status).toBe('pending');
  });
});


describe('findFundingOrderByOrderNo — 소문자 orderNo도 찾는다', () => {
  it('middleware.ts가 대문자 포함 경로를 소문자로 308 리다이렉트하므로, 소문자로 조회해도 대문자 주문을 찾아야 한다', async () => {
    const created = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable — 위 expect가 이미 걸렀다');

    const found = await findFundingOrderByOrderNo(created.orderNo.toLowerCase());
    expect(found?.orderNo).toBe(created.orderNo);
  });
});

describe('expireStalePledges · aggregateProjectStatus', () => {
  it('만료 pending은 expired, 집계는 paid만 센다', async () => {
    const stale = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), new Date(NOW.getTime() - 2000 * 1000));
    const paid = await createFundingPledge(payloadFor({ customerEmail: 'p@example.com', customerPhone: '010-7', additionalAmount: 2000 }), PROJECT, reward('mail'), NOW);
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [paid.ok ? paid.orderNo : ''] });
    await expireStalePledges(NOW);
    expect((await findFundingOrderByOrderNo(stale.ok ? stale.orderNo : ''))?.status).toBe('expired');
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s).toEqual({ raisedAmount: 7000, backerCount: 1, backerPersonCount: 1, remaining: { cd: 1, mail: null }, publicBackers: ['김후원'], publicMessages: [] });
  });

  it('partially_refunded도 paid와 같이 센다 — 후원은 살아 있고 재고도 나간 상태다', async () => {
    const partial = await createFundingPledge(payloadFor({ customerEmail: 'x@example.com', customerPhone: '010-8' }), PROJECT, reward('cd'), NOW);
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [partial.ok ? partial.orderNo : ''] });
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.raisedAmount).toBe(30000);
    expect(s.backerCount).toBe(1);
    expect(s.remaining.cd).toBe(0);
    expect(s.publicBackers).toEqual(['김후원']);
  });
});

/**
 * backerCount는 COUNT(*) — 후원 **건수**다. 같은 사람이 두 번 후원하면 2다. 그 값을
 * '후원자 N명'으로 적으면 인원이 부풀려진다. 필드 의미를 바꾸면 공개 소비처가 조용히 다른
 * 수를 그리므로, 인원은 **별도 필드**로 더한다.
 */
describe('aggregateProjectStatus — 건수와 인원을 따로 센다', () => {
  it('같은 고객(이메일+전화)이 여러 번 후원하면 건수만 늘고 인원은 그대로다', async () => {
    for (const email of ['dup@example.com', 'dup@example.com', 'solo@example.com']) {
      const c = await createFundingPledge(
        payloadFor({ customerEmail: email, customerPhone: email === 'dup@example.com' ? '010-111' : '010-222' }),
        PROJECT, reward('mail'), NOW,
      );
      await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [c.ok ? c.orderNo : ''] });
    }
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.backerCount).toBe(3); // 건수
    expect(s.backerPersonCount).toBe(2); // 인원
  });

  // 공개 집계도 같은 신원 키를 쓴다 — 수기 등록 플레이스홀더가 인원을 1로 붕괴시키면
  // 관리자 화면만 고쳐 봐야 공개 쪽에서 같은 거짓말이 나온다.
  it('연락처 없는 수기 등록은 주문 단위로 센다', async () => {
    for (let i = 0; i < 4; i += 1) {
      await client.execute({
        sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
              item_amount, vat_amount, total_amount, manage_token)
              VALUES (?,?,'funding','paid','현장후원','-','manual@studionol.co.kr',4545,455,5000,?)`,
        args: [`mo${i}`, `FND-M-${i}`, `mtok-${i}`],
      });
      await client.execute({
        sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount,
              quantity, additional_amount, payment_method, hold_expires_at, entry_source)
              VALUES (?,?,?,'mail','감사 메일',5000,1,0,'bank_transfer',9999999999,'manual')`,
        args: [`mfp${i}`, `mo${i}`, PROJECT.slug],
      });
    }
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.backerCount).toBe(4);
    expect(s.backerPersonCount).toBe(4);
  });

  it('이메일이 같아도 전화가 다르면 다른 사람으로 센다', async () => {
    for (const phone of ['010-1', '010-2']) {
      const c = await createFundingPledge(
        payloadFor({ customerEmail: 'shared@example.com', customerPhone: phone }), PROJECT, reward('mail'), NOW,
      );
      await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [c.ok ? c.orderNo : ''] });
    }
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.backerCount).toBe(2);
    expect(s.backerPersonCount).toBe(2);
  });
});

/**
 * 응원 메시지 공개는 **동의한 판본**에 묶인다. 옛 동의 문서는 메시지를 "운영자에게만
 * 보입니다"라고 약속했으므로, 문구를 바꿨다고 해서 이미 받은 메시지를 소급해 공개하면
 * 동의하지 않은 처리를 하는 것이 된다.
 */
describe('응원 메시지 공개', () => {
  const paidWith = async (over: Partial<CreatePledgePayload>, termsVersion?: string) => {
    const c = await createFundingPledge(payloadFor(over), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error('생성 실패');
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [c.orderNo] });
    if (termsVersion) {
      await client.execute({
        sql: 'UPDATE funding_pledges SET terms_version=? WHERE order_id=(SELECT id FROM orders WHERE order_no=?)',
        args: [termsVersion, c.orderNo],
      });
    }
    return c.orderNo;
  };

  it('현재 판본에 동의했고 공개에 동의했으면 메시지가 나간다', async () => {
    await paidWith({ customerEmail: 'm1@example.com', customerPhone: '010-9001', supporterMessage: '끝까지 함께합니다' });
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.publicMessages.map((m) => m.message)).toContain('끝까지 함께합니다');
  });

  /**
   * 판본 게이트는 걷었다. 그것이 가린 것은 운영자 본인의 후원 1건뿐이었고 본인이 공개를
   * 지시했다(2026-09-15). 이후 후원은 전부 현재 문서에 동의하므로 판본으로 가를 이유가 없다.
   */
  it('판본이 달라도 공개 동의만 있으면 메시지가 나간다', async () => {
    await paidWith(
      { customerEmail: 'm2@example.com', customerPhone: '010-9002', customerName: '옛동의자', supporterMessage: '옛 문서로 남긴 말' },
      'funding-terms-2026-01-01'
    );
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.publicMessages.map((m) => m.message)).toContain('옛 문서로 남긴 말');
    expect(s.publicBackers).toContain('옛동의자');
  });

  it('공개에 동의하지 않으면 이름도 메시지도 나가지 않는다', async () => {
    await paidWith({ customerEmail: 'm3@example.com', customerPhone: '010-9003', customerName: '비공개', displayNamePublic: false, supporterMessage: '조용히 응원' });
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.publicBackers).not.toContain('비공개');
    expect(s.publicMessages.map((m) => m.message)).not.toContain('조용히 응원');
  });

  it('공백만 남긴 메시지는 목록에 넣지 않는다', async () => {
    await paidWith({ customerEmail: 'm4@example.com', customerPhone: '010-9004', customerName: '공백', supporterMessage: '   ' });
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.publicMessages.find((m) => m.name === '공백')).toBeUndefined();
  });
});

/**
 * 후원을 취소하면 공개했던 이름과 응원 메시지도 함께 내려가야 한다. 돈을 돌려받은 사람이
 * 계속 후원자 명단에 남아 있으면 페이지가 사실과 다른 말을 하는 셈이다.
 */
describe('취소하면 공개 명단에서 내려간다', () => {
  const paidPublic = async (over: Partial<CreatePledgePayload>) => {
    const c = await createFundingPledge(payloadFor(over), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error('생성 실패');
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [c.orderNo] });
    return c.orderNo;
  };

  it('전액 환불되면 이름과 메시지가 모두 빠진다', async () => {
    const orderNo = await paidPublic({
      customerEmail: 'c1@example.com', customerPhone: '010-7001',
      customerName: '취소한사람', supporterMessage: '취소 전 남긴 말',
    });
    const before = await aggregateProjectStatus(PROJECT, NOW);
    expect(before.publicBackers).toContain('취소한사람');
    expect(before.publicMessages.map((m) => m.message)).toContain('취소 전 남긴 말');

    await client.execute({ sql: "UPDATE orders SET status='refunded' WHERE order_no=?", args: [orderNo] });

    const after = await aggregateProjectStatus(PROJECT, NOW);
    expect(after.publicBackers).not.toContain('취소한사람');
    expect(after.publicMessages.map((m) => m.message)).not.toContain('취소 전 남긴 말');
  });

  it('부분 환불은 남는다 — 후원은 살아 있고 재고도 나간 상태다', async () => {
    const orderNo = await paidPublic({
      customerEmail: 'c2@example.com', customerPhone: '010-7002',
      customerName: '부분환불', supporterMessage: '일부만 돌려받음',
    });
    await client.execute({ sql: "UPDATE orders SET status='partially_refunded' WHERE order_no=?", args: [orderNo] });
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.publicBackers).toContain('부분환불');
    expect(s.publicMessages.map((m) => m.message)).toContain('일부만 돌려받음');
  });

  it('결제 전(pending)에는 아직 나가지 않는다', async () => {
    const c = await createFundingPledge(
      payloadFor({ customerEmail: 'c3@example.com', customerPhone: '010-7003', customerName: '대기중', supporterMessage: '아직 결제 전' }),
      PROJECT, reward('mail'), NOW,
    );
    if (!c.ok) throw new Error('생성 실패');
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s.publicBackers).not.toContain('대기중');
    expect(s.publicMessages.map((m) => m.message)).not.toContain('아직 결제 전');
  });
});
