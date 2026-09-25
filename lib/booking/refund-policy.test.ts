import { computeRefund, PRACTICE_ROOM_REFUND_TIERS, refundPolicyFor, REFUND_TIERS } from './refund-policy';
import { getProduct } from './products';
import { daysUntilKst, kstDateString, kstDateTime } from './kst';

describe('kst helpers', () => {
  it('KST 벽시계 14시는 UTC 05시', () => {
    expect(kstDateTime('2026-09-10', 14).toISOString()).toBe('2026-09-10T05:00:00.000Z');
  });
  it('UTC 자정 직전은 KST 다음 날', () => {
    expect(kstDateString(new Date('2026-09-10T15:30:00Z'))).toBe('2026-09-11');
  });
  it('daysUntilKst는 달력일 차이 (시각 무관)', () => {
    const now = new Date('2026-09-07T13:00:00Z'); // KST 9/7 22:00
    const start = kstDateTime('2026-09-10', 10);
    expect(daysUntilKst(now, start)).toBe(3);
  });
});

describe('computeRefund — 기산은 KST 달력일, 계약서 시간대 분쟁(258e8e41cc) 재발 방지', () => {
  const start = kstDateTime('2026-09-10', 14);
  const total = 275000;
  it('3일 전 100%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-07', 23)).refundAmount).toBe(275000);
  });
  it('전일 50% (원 단위 내림)', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-09', 1)).refundAmount).toBe(137500);
  });
  it('당일 0%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-10', 0)).refundAmount).toBe(0);
  });
  it('지난 예약도 0%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-11', 10)).refundAmount).toBe(0);
  });
});

describe('연습실 시간제 환불 — 2일 전 전액 · 전날 50% · 당일 0 (2026-09-24 운영자 확정)', () => {
  const start = kstDateTime('2026-09-10', 3); // 새벽 3시 예약 — 24시간 상품이라 가능
  const total = 4400 * 3;
  const tiers = PRACTICE_ROOM_REFUND_TIERS;
  it('2일 전 100%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-08', 23), tiers).refundAmount).toBe(13200);
  });
  it('전날 50%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-09', 1), tiers).refundAmount).toBe(6600);
  });
  it('당일 0 — 새벽 예약을 같은 날 0시 넘어 취소해도 당일이다', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-10', 0), tiers).refundAmount).toBe(0);
  });
  it('녹음 세션은 같은 날짜 조건에서 다른 답(2일 전은 50%)', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-08', 23), REFUND_TIERS).refundAmount).toBe(6600);
  });
  it('refundPolicyFor — 상품으로 표와 문구를 함께 고른다', () => {
    expect(refundPolicyFor(getProduct('practice-room-hourly')).tiers).toBe(PRACTICE_ROOM_REFUND_TIERS);
    expect(refundPolicyFor(getProduct('recording-hourly')).tiers).toBe(REFUND_TIERS);
    expect(refundPolicyFor(undefined).tiers).toBe(REFUND_TIERS);
    expect(refundPolicyFor(getProduct('practice-room-hourly')).lines[0]).toContain('2일 전');
  });
});
