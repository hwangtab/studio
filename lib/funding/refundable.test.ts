import { readFileSync } from 'node:fs';
import path from 'node:path';

import { REFUND_PENDING_ORDER_STATUSES } from './policy';
import { LIVE_FUNDING_ORDER_STATUSES, isLiveFundingOrderStatus, remainingRefundable } from './refundable';
import type { FundingOrder } from './service';

const order = (totalAmount: number, refunds: Array<{ amount: number; status: string }>): FundingOrder =>
  ({
    totalAmount,
    payments: [{ refunds: refunds.map((r) => ({ ...r })) }],
  } as unknown as FundingOrder);

describe('remainingRefundable', () => {
  it('done 환불만 뺀다', () => {
    expect(remainingRefundable(order(10000, [{ amount: 3000, status: 'done' }, { amount: 5000, status: 'failed' }]))).toBe(7000);
  });
  it('음수로 내려가지 않는다', () => {
    expect(remainingRefundable(order(10000, [{ amount: 12000, status: 'done' }]))).toBe(0);
  });
});

describe('살아 있는 펀딩 판정', () => {
  it('paid·partially_refunded만 참', () => {
    expect(isLiveFundingOrderStatus('paid')).toBe(true);
    expect(isLiveFundingOrderStatus('partially_refunded')).toBe(true);
    for (const s of ['pending', 'refunded', 'failed', 'expired']) {
      expect(isLiveFundingOrderStatus(s)).toBe(false);
    }
  });

  /**
   * 근거가 다른 두 집합이지만 같은 "살아 있는 후원"을 가리켜야 한다. 갈리면 화면·API·헬스체크가
   * 서로 다른 사실을 말한다 — 발송 기록이 'paid' 하나로 굳어 부분환불 건을 영구 미발송으로
   * 남기던 버그가 정확히 그 형태였다.
   */
  it('policy.ts의 REFUND_PENDING_ORDER_STATUSES와 같은 집합이다', () => {
    expect([...LIVE_FUNDING_ORDER_STATUSES].sort()).toEqual([...REFUND_PENDING_ORDER_STATUSES].sort());
  });
});

/**
 * 판정이 다시 흩어지는 것을 소스 수준에서 막는다. 상태 문자열을 쿼리마다 다시 적는 순간
 * 한 곳만 고치는 사고가 되살아난다 — 이 저장소가 실제로 겪은 형태다.
 *
 * **판정 방식**: 소스를 정규화한 뒤(따옴표 통일, 공백 제거) `('paid','partially_refunded')`나
 * `['paid','partially_refunded']` 같은 **두 원소짜리 목록**만 잡는다. 표기 순서나 쌍따옴표를
 * 바꿔도 걸리고, `['paid','partially_refunded','refunded']`처럼 **다른 집합**을 말하는
 * 목록은(괄호로 닫히지 않으므로) 잡지 않는다 — 그건 "돈이 들어온 흔적이 있는 상태"라는
 * 별개의 개념이라 헬퍼로 바꾸면 오히려 뜻이 틀어진다.
 *
 * 목록은 opt-in이다. 새로 이 집합을 보는 파일을 만들면 **여기에 함께 등재할 것** — 등재를
 * 빠뜨리면 이 가드가 그 파일을 안 본다(실제로 confirm.ts·cancel.ts가 그렇게 빠져 있었다).
 */
const LIVE_STATUS_CONSUMERS = [
  'lib/funding/service.ts',
  'lib/funding/admin-list.ts',
  'lib/funding/cancel.ts',
  'lib/funding/confirm.ts',
  'lib/funding/fulfillment.ts',
  'pages/admin/funding/[id].tsx',
];

/** 따옴표·공백 표기를 흡수한다 — `"paid" , "partially_refunded"`도 같은 것으로 본다. */
const normalizeSource = (src: string): string => src.replace(/["'`]/g, "'").replace(/\s+/g, '');

/** 두 원소짜리 목록만 — 괄호·대괄호로 양끝이 닫힌 경우. 더 긴 목록(다른 집합)은 제외된다. */
const TWO_ELEMENT_LIST =
  /[[(]'paid','partially_refunded'[\])]|[[(]'partially_refunded','paid'[\])]/g;

describe('상태 리터럴이 정본 밖에 흩어져 있지 않다', () => {
  it.each(LIVE_STATUS_CONSUMERS)('%s', (file) => {
    const src = normalizeSource(readFileSync(path.join(process.cwd(), file), 'utf-8'));
    expect({ file, hits: src.match(TWO_ELEMENT_LIST) ?? [] }).toEqual({ file, hits: [] });
  });

  // 리터럴이 없다고 끝이 아니다 — 판정 자체가 사라졌을 수도 있다. 헬퍼를 실제로 쓰는지 본다.
  it.each(LIVE_STATUS_CONSUMERS)('%s는 헬퍼를 실제로 쓴다', (file) => {
    const src = readFileSync(path.join(process.cwd(), file), 'utf-8');
    expect(/isLiveFundingOrderStatus|liveFundingOrderStatusList|LIVE_FUNDING_ORDER_STATUSES/.test(src)).toBe(true);
  });

  // 정규화·정규식이 실제로 표기 변형을 잡는지 — 가드 자신을 검증한다.
  it.each([
    `inArray(t.status, ["paid",  "partially_refunded"])`,
    `status IN ('partially_refunded','paid')`,
    `['paid',\n  'partially_refunded']`,
  ])('표기를 바꿔도 잡는다: %s', (sample) => {
    expect(normalizeSource(sample).match(TWO_ELEMENT_LIST)).not.toBeNull();
  });

  it('다른 집합(세 원소 이상)은 잡지 않는다', () => {
    const sample = `['paid', 'partially_refunded', 'refunded']`;
    expect(normalizeSource(sample).match(TWO_ELEMENT_LIST)).toBeNull();
  });
});
