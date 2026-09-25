/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../../../lib/funding/service', () => {
  const actual = jest.requireActual('../../../../../lib/funding/service');
  return {
    ...actual,
    expireStalePledges: jest.fn().mockResolvedValue(undefined),
    // 사전 검사와 INSERT 사이의 경합을 재현하려면 "읽기 시점의 낡은 스냅샷"을 만들 수 있어야
    // 한다. 기본 구현은 실제 함수 그대로다.
    aggregateProjectStatus: jest.fn((...args: unknown[]) => actual.aggregateProjectStatus(...args)),
  };
});
jest.mock('../../../../../lib/funding/projects', () => ({
  ...jest.requireActual('../../../../../lib/funding/projects'),
  getFundingProject: (slug: string) => (slug === 'demo' ? PROJECT : null),
}));
jest.mock('../../../../../lib/funding/email', () => ({
  ...jest.requireActual('../../../../../lib/funding/email'),
  sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null),
}));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../../../pages/api/admin/funding/pledges/index';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../../lib/funding/projects';
// eslint-disable-next-line import/first
import { aggregateProjectStatus } from '../../../../../lib/funding/service';
// eslint-disable-next-line import/first
import { sendFundingConfirmedEmails } from '../../../../../lib/funding/email';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
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
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 1
    requiresShipping: false
    estimatedDelivery: 2026-12
---
`, 'demo');

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
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
  (sendFundingConfirmedEmails as jest.Mock).mockClear();
  (sendFundingConfirmedEmails as jest.Mock).mockResolvedValue(null);
});

const call = async (body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, query: {}, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const VALID_BODY = {
  projectSlug: 'demo',
  rewardId: 'mail',
  quantity: 2,
  additionalAmount: 1000,
  customerName: '김후원',
  customerPhone: '010-1234-5678',
  customerEmail: 'a@example.com',
};

it('수기 등록 → orders paid·FND-M-·payments 없음, funding_pledges manual·bank_transfer·paidAt 있음', async () => {
  const r = await call(VALID_BODY);
  expect(r.status).toBe(201);
  expect(r.body.orderNo).toMatch(/^FND-M-/);

  const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
  expect(order.rows[0]?.status).toBe('paid');

  const payments = await client.execute({ sql: 'SELECT * FROM payments WHERE order_id = ?', args: [order.rows[0]?.id as string] });
  expect(payments.rows).toHaveLength(0);

  const pledge = await client.execute({ sql: 'SELECT * FROM funding_pledges WHERE order_id = ?', args: [order.rows[0]?.id as string] });
  expect(pledge.rows[0]?.entry_source).toBe('manual');
  expect(pledge.rows[0]?.payment_method).toBe('bank_transfer');
  expect(pledge.rows[0]?.paid_at).not.toBeNull();
});

it('quantity 11 → 400', async () => {
  const r = await call({ ...VALID_BODY, quantity: 11 });
  expect(r.status).toBe(400);
});

it('한정 수량 리워드가 이미 소진되면 409 남은 수량 메시지', async () => {
  const first = await call({ ...VALID_BODY, rewardId: 'cd', quantity: 1, additionalAmount: 0 });
  expect(first.status).toBe(201);

  const second = await call({ ...VALID_BODY, rewardId: 'cd', quantity: 1, additionalAmount: 0 });
  expect(second.status).toBe(409);
  expect(second.body.message).toBe('남은 수량(0)을 초과합니다.');
});

// ?? 는 빈 문자열을 통과시킨다 — 관리자 폼이 비운 칸을 그대로 보내면 customer_email=''인
// 주문이 생겨, 나중에 보내는 확정·환불 메일이 빈 주소로 나가고 조용히 실패한다.
it.each<[string | undefined, string]>([['', '빈 문자열'], ['   ', '공백만'], [undefined, '미전송']])(
  '이메일이 %s(%s)면 플레이스홀더 주소로 저장한다',
  async (customerEmail) => {
    const r = await call({ ...VALID_BODY, customerEmail });
    expect(r.status).toBe(201);
    const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
    expect(order.rows[0]?.customer_email).toBe('manual@studionol.co.kr');
  },
);

// 소문자로 맞추는 이유는 온라인 경로와 같다 — 인원 집계의 신원 키가 이메일이라,
// 대소문자만 다른 표기가 같은 사람을 둘로 센다.
it('이메일은 앞뒤 공백을 정리하고 소문자로 저장한다', async () => {
  const r = await call({ ...VALID_BODY, customerEmail: '  Real@Example.COM  ' });
  const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
  expect(order.rows[0]?.customer_email).toBe('real@example.com');
});

/**
 * 수기 등록도 온라인 경로와 같은 원자적 재고 조건을 써야 한다.
 *
 * 예전엔 aggregateProjectStatus로 remaining을 읽어 검사한 뒤 **무조건** INSERT했다. 그 읽기와
 * 쓰기 사이(수백 ms)에 온라인 후원자가 같은 한정 리워드를 집으면 양쪽 다 검사를 통과해
 * 한정 수량을 초과 판매했다. 둘 다 확정 상태라 자동 취소 대상이 아니고, remaining은
 * Math.max로 하한이 걸려 화면엔 '품절'로만 보여 초과분이 드러나지도 않았다.
 *
 * 여기서는 사전 검사가 낡은 스냅샷(재고 남음)을 보게 하고 실제 DB 재고는 0으로 만든다 —
 * 막아 내는 것이 INSERT의 WHERE뿐임을 보이기 위해서다.
 */
it('사전 검사 뒤 재고가 소진되면 409 — 고아 주문도 남기지 않는다', async () => {
  // 실제 재고는 이미 0 — 한정 1개짜리 CD를 온라인 후원이 pending 홀드로 잡은 상태.
  await client.execute(`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
      manage_token, item_amount, vat_amount, total_amount, created_at, updated_at)
    VALUES ('rival','FND-RIVAL','funding','pending','경쟁자','010-2','r@example.com','tok-rival',27273,2727,30000, unixepoch(), unixepoch())`);
  await client.execute(`INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount,
      quantity, additional_amount, payment_method, hold_expires_at, created_at, updated_at)
    VALUES ('rival-p','rival','demo','cd','CD',30000,1,0,'toss', unixepoch()+900, unixepoch(), unixepoch())`);

  // 읽기 시점의 낡은 스냅샷 — 사전 검사는 이걸 보고 통과한다.
  (aggregateProjectStatus as jest.Mock).mockResolvedValueOnce({
    raisedAmount: 0, backerCount: 0, backerPersonCount: 0, remaining: { cd: 1, mail: null }, publicBackers: [],
  });

  const r = await call({ ...VALID_BODY, rewardId: 'cd', quantity: 1, additionalAmount: 0 });
  expect(r.status).toBe(409);

  /**
   * 진 쪽의 주문은 **온라인 경로와 같은 모양**(status='failed')으로 남아야 한다. paid로
   * 남으면 pledge 없는 확정 주문이 되어 목록·CSV·집계가 서로 다르게 취급한다.
   */
  const orphans = await client.execute(
    "SELECT status, notification_error FROM orders o WHERE o.type='funding' AND NOT EXISTS (SELECT 1 FROM funding_pledges fp WHERE fp.order_id = o.id)",
  );
  expect(orphans.rows.map((r) => String(r.status))).toEqual(['failed']);
  /**
   * M3 — 발송권 선점용 센티널(SEND_PENDING)이 실패 주문에 남으면 지울 경로가 없다.
   * 헬스체크는 상태를 안 보고 isNotNull만 보고, 그 주문은 pledge가 없어 관리자 목록에
   * 안 떠 재발송 버튼(센티널을 지우는 유일한 경로)에 닿을 수 없다.
   */
  expect(orphans.rows.map((r) => r.notification_error)).toEqual([null]);

  // 한정 수량도 지켜져야 한다 — CD pledge는 여전히 1건뿐.
  const cd = await client.execute("SELECT COUNT(*) AS c FROM funding_pledges WHERE reward_id='cd'");
  expect(Number(cd.rows[0].c)).toBe(1);
});

/**
 * 수기 등록도 **등록 그 자리에서** 확정 메일을 보낸다. 예전엔 안 보내서, 운영자가 관리자
 * 상세의 '메일 재발송'을 따로 눌러야 후원자가 관리 링크(셀프 취소·명단 공개 철회)를 받았다.
 */
it('실제 이메일이면 확정 메일이 자동으로 나가고 센티널이 지워진다', async () => {
  const r = await call({ ...VALID_BODY, customerEmail: 'real@example.com' });
  expect(r.status).toBe(201);
  expect(sendFundingConfirmedEmails).toHaveBeenCalledTimes(1);

  const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
  // 발송이 끝나면 센티널은 결과(성공 = NULL)로 덮인다.
  expect(order.rows[0]?.notification_error).toBeNull();
});

it('플레이스홀더 이메일이면 확정 메일을 보내지 않고 센티널도 남기지 않는다', async () => {
  const r = await call({ ...VALID_BODY, customerEmail: '' });
  expect(r.status).toBe(201);
  expect(sendFundingConfirmedEmails).not.toHaveBeenCalled();

  const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
  expect(order.rows[0]?.notification_error).toBeNull();
});

it('메일 발송이 실패해도 등록은 201이고 사유가 notification_error에 남는다', async () => {
  (sendFundingConfirmedEmails as jest.Mock).mockResolvedValue('customer:RESEND_5XX');
  const r = await call({ ...VALID_BODY, customerEmail: 'real@example.com' });
  expect(r.status).toBe(201);

  const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
  expect(order.rows[0]?.notification_error).toBe('customer:RESEND_5XX');
  // 등록 자체는 그대로 확정이다 — 메일 실패가 후원 기록을 되돌리지 않는다.
  expect(order.rows[0]?.status).toBe('paid');
});

it('메일 발송이 예외를 던져도 등록은 201이고 예외 메시지가 기록된다', async () => {
  (sendFundingConfirmedEmails as jest.Mock).mockRejectedValue(new Error('resend down'));
  const r = await call({ ...VALID_BODY, customerEmail: 'real@example.com' });
  expect(r.status).toBe(201);

  const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
  expect(order.rows[0]?.notification_error).toBe('resend down');
});

/**
 * 실수령액 — 현금으로 실제 받은 액수가 리워드 단가 × 수량 + 추가금과 안 맞을 수 있다
 * (에누리·잔돈). 그 칸이 없을 때는 공개 모금액과 정산 grossAmount가 실수령액과 어긋났다.
 */
describe('실수령액(actualAmount)', () => {
  it('있으면 그 값이 total_amount가 되고 item + vat === total', async () => {
    const r = await call({ ...VALID_BODY, actualAmount: 9000 });
    expect(r.status).toBe(201);
    const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
    expect(Number(order.rows[0]?.total_amount)).toBe(9000);
    expect(Number(order.rows[0]?.item_amount) + Number(order.rows[0]?.vat_amount)).toBe(9000);
  });

  it('없으면 지금처럼 리워드 단가 × 수량 + 추가금', async () => {
    // mail 5,000원 × 2 + 추가 1,000원 = 11,000원
    const r = await call(VALID_BODY);
    const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
    expect(Number(order.rows[0]?.total_amount)).toBe(11000);
  });

  it.each([[0, '0원'], [-1, '음수'], [1000.5, '소수'], [50_000_001, '상한 초과']])(
    '%s(%s)이면 400 — 주문을 만들지 않는다',
    async (actualAmount) => {
      const r = await call({ ...VALID_BODY, actualAmount });
      expect(r.status).toBe(400);
      const orders = await client.execute('SELECT COUNT(*) AS c FROM orders');
      expect(Number(orders.rows[0].c)).toBe(0);
    },
  );

  it('상한값 정확히는 통과한다', async () => {
    const r = await call({ ...VALID_BODY, actualAmount: 50_000_000 });
    expect(r.status).toBe(201);
    const order = await client.execute({ sql: 'SELECT * FROM orders WHERE order_no = ?', args: [r.body.orderNo] });
    expect(Number(order.rows[0]?.total_amount)).toBe(50_000_000);
  });
});
