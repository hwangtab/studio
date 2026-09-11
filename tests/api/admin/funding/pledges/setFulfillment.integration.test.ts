/** @jest-environment node */
/**
 * set_fulfillment을 실 DB(in-memory libSQL)로 본다. 여기서 확인하는 두 가지는 목 객체로는
 * 증명할 수 없다.
 *
 * 1) **경합 가드가 WHERE에 있다.** 예전 구현은 상태를 읽어 검사한 뒤 무조건 UPDATE했다.
 *    읽기와 쓰기 사이에 환불 요청이 들어오면 검사를 통과한 요청이 그대로 '발송완료'를
 *    적어, 청약철회한 사람에게 실물이 나간 기록이 시스템 안에서 정상 발송으로 굳는다.
 * 2) **delivered_at이 실제로 채워진다.** 컬럼은 있었지만 채우는 코드가 없어, 약관 제13조가
 *    약속한 '리워드 전달 완료 후 1년 파기'의 기산점이 비어 있었다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../../../lib/funding/email', () => ({
  sendFundingConfirmedEmails: jest.fn(), sendFundingBankDepositEmails: jest.fn(), sendFundingRefundRequestClearedEmails: jest.fn(),
}));
jest.mock('../../../../../lib/funding/projects', () => ({ getFundingProject: jest.fn() }));
// 경합 재현용 — 라우트가 읽은 스냅샷만 낡게 만들고 DB는 진짜로 바꾼다. 사전 검사는 그
// 낡은 스냅샷을 보고 통과하므로, 막아 내는 것은 UPDATE의 WHERE뿐이다.
jest.mock('../../../../../lib/funding/service', () => {
  const actual = jest.requireActual('../../../../../lib/funding/service');
  return { ...actual, findFundingOrderById: jest.fn(actual.findFundingOrderById) };
});

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../../../pages/api/admin/funding/pledges/[id]';
// eslint-disable-next-line import/first
import { findFundingOrderById } from '../../../../../lib/funding/service';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const call = async (body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'PATCH', query: { id: 'order-1' }, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const pledgeRow = async () => {
  const r = await client.execute('SELECT fulfillment_status, delivered_at, tracking_company, tracking_number FROM funding_pledges WHERE id = \'pledge-1\'');
  return r.rows[0] as unknown as {
    fulfillment_status: string; delivered_at: number | null;
    tracking_company: string | null; tracking_number: string | null;
  };
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
afterAll(() => client.close());

beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM orders');
  await client.execute(`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
    item_amount, vat_amount, total_amount, manage_token)
    VALUES ('order-1','FND-20261015-AAAA1111','funding','paid','김후원','010-1','a@example.com',27273,2727,30000,'tok-1')`);
  await client.execute(`INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount,
    quantity, additional_amount, payment_method, hold_expires_at, fulfillment_status)
    VALUES ('pledge-1','order-1','demo','cd','CD',30000,1,0,'bank_transfer',9999999999,'none')`);
});

it('delivered로 바꾸면 delivered_at이 채워진다 — 파기 기한의 기산점', async () => {
  const before = Math.floor(Date.now() / 1000) - 1;
  expect((await call({ action: 'set_fulfillment', fulfillmentStatus: 'delivered' })).status).toBe(200);
  const row = await pledgeRow();
  expect(row.fulfillment_status).toBe('delivered');
  expect(row.delivered_at).toBeGreaterThanOrEqual(before);
});

it('delivered가 아닌 상태에서는 delivered_at이 비어 있다', async () => {
  await call({ action: 'set_fulfillment', fulfillmentStatus: 'shipped' });
  expect((await pledgeRow()).delivered_at).toBeNull();
});

/**
 * 운송장만 고쳐 다시 저장하는 건 흔한 실무다. 그때마다 기산점이 밀리면 파기 시점도 함께
 * 밀린다 — 첫 전달 시각을 보존한다(COALESCE).
 */
it('delivered 상태에서 다시 저장해도 첫 전달 시각이 밀리지 않는다', async () => {
  await call({ action: 'set_fulfillment', fulfillmentStatus: 'delivered' });
  const first = (await pledgeRow()).delivered_at;
  await client.execute("UPDATE funding_pledges SET delivered_at = 1000000000 WHERE id = 'pledge-1'");
  await call({ action: 'set_fulfillment', fulfillmentStatus: 'delivered', trackingNumber: '999' });
  expect((await pledgeRow()).delivered_at).toBe(1_000_000_000);
  expect(first).not.toBeNull();
});

/**
 * 오조작 정정·반송으로 delivered에서 되돌릴 때는 NULL로 되돌린다. 잘못 눌러 찍힌 시각을
 * 남겨 두면 아직 배송 중인 건의 배송지가 1년 뒤 파기 대상이 된다 — 기산점은 항상 현재
 * fulfillment_status와 일치해야 한다.
 */
it('delivered에서 되돌리면 delivered_at을 NULL로 지운다', async () => {
  await call({ action: 'set_fulfillment', fulfillmentStatus: 'delivered' });
  expect((await pledgeRow()).delivered_at).not.toBeNull();
  await call({ action: 'set_fulfillment', fulfillmentStatus: 'preparing' });
  const row = await pledgeRow();
  expect(row.fulfillment_status).toBe('preparing');
  expect(row.delivered_at).toBeNull();
});

// 빈 문자열은 "지우기"다 — null로 저장돼야 잘못 입력한 운송장을 비울 수 있다.
it('빈 문자열 운송장은 null로 저장된다', async () => {
  await call({ action: 'set_fulfillment', fulfillmentStatus: 'shipped', trackingCompany: 'CJ대한통운', trackingNumber: '123' });
  expect((await pledgeRow()).tracking_company).toBe('CJ대한통운');
  await call({ action: 'set_fulfillment', fulfillmentStatus: 'shipped', trackingCompany: '', trackingNumber: '' });
  const row = await pledgeRow();
  expect(row.tracking_company).toBeNull();
  expect(row.tracking_number).toBeNull();
});

/**
 * 읽고-검사-쓰기 경합의 재현. findFundingOrderById가 돌려준 스냅샷은 여전히
 * refund_requested_at IS NULL이지만, 그 사이 DB에는 환불 요청이 들어와 있다. 가드가
 * WHERE에 없으면 이 UPDATE가 그대로 성립해 청약철회한 건이 '발송완료'로 굳는다.
 */
it('읽은 뒤 환불 요청이 들어오면 UPDATE가 0행 — 409, 상태를 바꾸지 않는다', async () => {
  // 라우트가 읽는 시점의 스냅샷(환불 요청 없음)을 그대로 붙잡아 둔다.
  const stale = await jest.requireActual('../../../../../lib/funding/service').findFundingOrderById('order-1');
  expect(stale.fundingPledge.refundRequestedAt).toBeNull();
  await client.execute("UPDATE funding_pledges SET refund_requested_at = unixepoch() WHERE id = 'pledge-1'");
  (findFundingOrderById as jest.Mock).mockResolvedValueOnce(stale);

  // 사전 검사는 낡은 스냅샷을 보고 통과한다 — 여기서 409가 나오는 이유는 WHERE뿐이다.
  const r = await call({ action: 'set_fulfillment', fulfillmentStatus: 'delivered' });
  expect(r.status).toBe(409);
  expect(r.body.message).toContain('새로고침');
  const row = await pledgeRow();
  expect(row.fulfillment_status).toBe('none');
  expect(row.delivered_at).toBeNull();
});

// 같은 경합이 주문 상태 쪽에서도 난다 — 관리자 환불이 먼저 커밋되면 발송은 성립하면 안 된다.
it('읽은 뒤 주문이 환불되면 UPDATE가 0행 — 409', async () => {
  const stale = await jest.requireActual('../../../../../lib/funding/service').findFundingOrderById('order-1');
  expect(stale.status).toBe('paid');
  await client.execute("UPDATE orders SET status = 'refunded' WHERE id = 'order-1'");
  (findFundingOrderById as jest.Mock).mockResolvedValueOnce(stale);

  const r = await call({ action: 'set_fulfillment', fulfillmentStatus: 'shipped' });
  expect(r.status).toBe(409);
  expect((await pledgeRow()).fulfillment_status).toBe('none');
});
