import { DEFAULT_LINE_OF_TYPE, expenseBucketOfScope, lineOfRow, lineOfSessionService, lineOfSubscriptionKind, lineOfType, parseBusinessLine } from './businessLine';
import { REVENUE_TYPE_LABELS } from './revenueReport';

jest.mock('../../db/client', () => ({ getDb: () => { throw new Error('DB를 쓰지 않는다'); } }));

describe('분야 판정', () => {
  it('매출 유형마다 기본 분야가 정해져 있다(새 유형을 더하면 여기서 실패한다)', () => {
    expect(Object.keys(DEFAULT_LINE_OF_TYPE).sort()).toEqual(Object.keys(REVENUE_TYPE_LABELS).sort());
    expect(Object.fromEntries(Object.keys(REVENUE_TYPE_LABELS).map((t) => [t, lineOfType(t)]))).toEqual({
      session: 'recording',
      mixing: 'recording',
      production: 'recording',
      subscription: 'other',
      lesson: 'other',
      deposit: 'recording',
      software: 'other',
      tenancy: 'practice',
      funding: 'platform',
      ticket: 'platform',
      merch: 'platform',
      other: 'other',
    });
    expect(lineOfType('모르는-유형')).toBe('other');
  });

  it('세션 예약은 서비스 종류로 연습실/녹음·제작을 가른다', () => {
    expect(lineOfSessionService('practice-room')).toBe('practice');
    expect(lineOfSessionService('recording')).toBe('recording');
    expect(lineOfSessionService('voice-acting')).toBe('recording');
    expect(lineOfSessionService(undefined)).toBeNull();
  });

  it('구독은 종류로 — 연습실 월 이용료는 연습실, 아티스트 구독은 플랫폼', () => {
    expect(lineOfSubscriptionKind('practice-room')).toBe('practice');
    expect(lineOfSubscriptionKind('artist-support')).toBe('platform');
    expect(lineOfSubscriptionKind('lesson')).toBe('other');
    expect(lineOfSubscriptionKind(undefined)).toBeNull();
    // 모르는 구독 종류는 지정이 없으니 유형(subscription)의 기본값 — 기타.
    expect(lineOfSubscriptionKind('mystery-kind')).toBeNull();
    expect(lineOfRow({ type: 'subscription', line: lineOfSubscriptionKind('mystery-kind') })).toBe('other');
  });

  it('행에 분야가 있으면 그것(결제 링크·수기 매출 지정), 없으면 유형의 기본값', () => {
    expect(lineOfRow({ type: 'deposit' })).toBe('recording');
    expect(lineOfRow({ type: 'deposit', line: 'practice' })).toBe('practice');
    expect(lineOfRow({ type: 'session', line: 'practice' })).toBe('practice');
    expect(lineOfRow({ type: 'session' })).toBe('recording');
    expect(lineOfRow({ type: 'other', line: 'platform' })).toBe('platform');
  });

  it('분야 값 파싱', () => {
    expect(parseBusinessLine('platform')).toBe('platform');
    expect(parseBusinessLine(['practice'])).toBe('practice');
    expect(parseBusinessLine('studio')).toBeNull();
    expect(parseBusinessLine(undefined)).toBeNull();
  });

  it("지출 구분 'studio'는 공통이다", () => {
    expect(expenseBucketOfScope('studio')).toBe('common');
    expect(expenseBucketOfScope('practice')).toBe('practice');
    expect(expenseBucketOfScope('recording')).toBe('recording');
    expect(expenseBucketOfScope('platform')).toBe('platform');
    expect(expenseBucketOfScope('뭔가')).toBe('common');
  });
});
