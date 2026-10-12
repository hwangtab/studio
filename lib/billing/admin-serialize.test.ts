import type { BillingKey, Subscription } from '../../db/schema';
import { serializeBillingKey, serializeSubscription } from './admin-serialize';

// 관리자 화면 props는 __NEXT_DATA__로 HTML에 박히고 관리자 API 응답도 같은 함수를 거친다 —
// 고객 상시 토큰과 빌링키 원문이 직렬화 결과에 남으면 안 된다.
describe('admin-serialize — 자격증명 제외', () => {
  const now = new Date('2026-10-12T00:00:00Z');

  it('serializeSubscription은 manageToken·setupToken·customerKey를 떨어뜨린다', () => {
    const sub = {
      id: 'sub-1', kind: 'practice-room', status: 'active', customerName: '홍길동',
      manageToken: 'MANAGE-SECRET', setupToken: 'SETUP-SECRET', customerKey: 'CUSTOMER-SECRET',
      pausedUntil: null, resumeNoticePendingAt: null, nextBillingAt: now, currentPeriodStart: now,
      currentPeriodEnd: null, setupTokenExpiresAt: now, cancelledAt: null, endsAt: null,
      createdAt: now, updatedAt: now,
    } as unknown as Subscription;
    const out = JSON.stringify(serializeSubscription(sub));
    expect(out).not.toContain('manageToken');
    expect(out).not.toContain('setupToken"');
    expect(out).not.toContain('customerKey');
    expect(out).not.toContain('SECRET');
    expect(out).toContain('"customerName":"홍길동"');
    expect(out).toContain('"nextBillingAt":"2026-10-12T00:00:00.000Z"');
  });

  it('serializeBillingKey는 허용 목록(카드사·마스킹 번호·종류·일시)만 남긴다', () => {
    const key = {
      id: 'bk-1', subscriptionId: 'sub-1', billingKey: 'BILLING-SECRET',
      rawResponse: '{"billingKey":"BILLING-SECRET"}', cardCompany: '현대', cardNumberMasked: '1234-****-****-5678',
      cardType: '신용', issuedAt: now, revokedAt: null, createdAt: now,
    } as unknown as BillingKey;
    const result = serializeBillingKey(key);
    expect(Object.keys(result).sort()).toEqual(
      ['cardCompany', 'cardNumberMasked', 'cardType', 'createdAt', 'id', 'issuedAt', 'revokedAt', 'subscriptionId'],
    );
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
});
