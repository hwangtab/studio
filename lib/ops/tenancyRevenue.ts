import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { kstDateString } from '../booking/kst';
import type { RevenueRow } from './revenueReport';

/**
 * 연습실 월 입주 매출 — **입주해 있는 달마다 월 이용료**(발생 기준). 월세는 결제 행(`payments`)을 남기지 않아 매출 현황에서 통째로 빠져 있었다.
 *
 * 입금일 기준(`room_tenancy_payments`)으로 읽으면 안 된다 — 달 중순까지 입금일이 안 온 사람이 빠져 이번 달 매출이 모자라 보인다
 * (2026-10-21에 예정 5,005,000원이 3,786,000원으로 보였다). 다들 예정일에 내고, 매출이 줄어드는 것은 **방이 비었을 때뿐**이라는
 * 운영 판단(2026-10-21)에 따라 입주 기록(`room_tenancies`)만 본다. 입금이 늦은 사람은 연체 알림이 따로 잡는다.
 *
 * - 한 입주자·한 달이 한 행. 그 달에 **하루라도 입주해 있으면**(입주일 ≤ 말일, 퇴실일 없거나 ≥ 1일) 월 이용료 전액 — 월세는 선불이라
 *   중간에 들어오거나 나가도 그 달 치는 받는다. 첫 달 일할 계산·할인은 여기서 반영하지 않는다(입주 기록에 없다).
 * - 금액은 지금의 월 이용료다 — 과거 달에도 같은 금액으로 센다(요금 변경 이력이 없다).
 * - **오늘이 속한 달까지만** 만든다. 앞으로 올 달은 아직 매출이 아니다.
 * - 퇴실 처리됐는데 퇴실일이 비어 있으면 마지막 입금일을 퇴실일로 본다(그것도 없으면 입주일).
 * - 부가세는 0으로 둔다 — 월 이용료는 부가세 별도 표기고 기록에 포함 여부가 없다. 이름·연락처는 읽지도 싣지도 않는다(방 번호만).
 * 표가 없는 DB(0066 전)에서는 읽기가 던진다 — 호출부가 잡아 "월 입주 수입을 못 읽었다"고 알린다.
 */

const pad = (n: number): string => String(n).padStart(2, '0');
const lastDayOf = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const loadTenancyRevenueRows = async (range: { from: Date; toExclusive: Date }, now: Date = new Date()): Promise<RevenueRow[]> => {
  const from = kstDateString(range.from);
  const to = kstDateString(range.toExclusive);
  const nowMonth = kstDateString(now).slice(0, 7);
  const tenancies = await getDb().all<{ id: string; kind: string; room_number: string | null; monthly_amount: number; start_date: string; left_on: string | null }>(sql`
    SELECT t.id AS id, t.kind AS kind, t.room_number AS room_number, t.monthly_amount AS monthly_amount, t.start_date AS start_date,
      CASE WHEN t.status = 'ended'
        THEN COALESCE(t.ended_on, (SELECT MAX(p.paid_on) FROM room_tenancy_payments p WHERE p.tenancy_id = t.id), t.start_date)
        ELSE NULL END AS left_on
    FROM room_tenancies t
    WHERE t.monthly_amount > 0
  `);

  const rows: RevenueRow[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (let i = 0; i < 36; i += 1) {
    const monthKey = `${y}-${pad(m)}`;
    const first = `${monthKey}-01`;
    if (first >= to || monthKey > nowMonth) break;
    const last = `${monthKey}-${pad(lastDayOf(y, m))}`;
    for (const t of tenancies) {
      if (t.start_date > last) continue;
      if (t.left_on !== null && t.left_on < first) continue;
      rows.push({
        at: new Date(new Date(`${first}T00:00:00Z`).getTime() - 9 * 60 * 60 * 1000),
        orderNo: `${t.kind === 'virtual' ? '비상주' : (t.room_number ?? '방')} 월 입주`,
        type: 'tenancy',
        projectSlug: null,
        method: '월 입주',
        gross: Number(t.monthly_amount),
        vat: 0,
        refunded: 0,
        offline: true,
      });
    }
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return rows;
};
