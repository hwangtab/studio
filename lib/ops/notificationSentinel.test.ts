/** @jest-environment node */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SEND_INFLIGHT,
  SEND_PENDING,
  describeNotificationError,
  isNotificationSentinel,
} from './notificationSentinel';

describe('describeNotificationError', () => {
  it('값이 없으면 null이다', () => {
    expect(describeNotificationError(null)).toBeNull();
    expect(describeNotificationError(undefined)).toBeNull();
    expect(describeNotificationError('')).toBeNull();
  });

  /**
   * 이 저장소가 실제로 낸 증상: 관리자 화면이 원문을 그대로 찍어
   * "알림 발송에 실패했습니다 send_inflight"가 보였다. 두 가지가 동시에 틀렸다 —
   * 내부 예약어가 노출됐고, 진행 중인 상태를 "실패"라고 말했다.
   */
  it.each([SEND_PENDING, SEND_INFLIGHT])('센티널 %s는 실패가 아니라 진행/대기로 말한다', (value) => {
    const copy = describeNotificationError(value);
    expect(copy).not.toBeNull();
    expect(copy!.kind).toBe('sentinel');
    expect(copy!.title).not.toContain('실패');
    // 어떤 칸에도 원문 예약어가 새어 나가면 안 된다.
    expect(`${copy!.title}${copy!.detail}${copy!.badge}`).not.toContain(value);
  });

  it('두 센티널은 서로 다른 상황이라 문구도 갈린다', () => {
    const pending = describeNotificationError(SEND_PENDING)!;
    const inflight = describeNotificationError(SEND_INFLIGHT)!;
    expect(pending.title).not.toBe(inflight.title);
    expect(pending.badge).not.toBe(inflight.badge);
  });

  it('실제 실패 사유는 원문을 그대로 싣는다 — 그게 가장 유용한 정보다', () => {
    const reason = 'Resend 550: recipient rejected';
    const copy = describeNotificationError(reason)!;
    expect(copy.kind).toBe('failure');
    expect(copy.title).toContain('실패');
    expect(copy.detail).toBe(reason);
  });

  it('센티널과 비슷하지만 다른 문자열은 실패로 다룬다', () => {
    expect(describeNotificationError('send_pending 이후 타임아웃')!.kind).toBe('failure');
    expect(isNotificationSentinel('send_pending 이후 타임아웃')).toBe(false);
  });
});

/**
 * 센티널 값은 이 모듈이 정본이고 confirm.ts 두 곳이 **가져다 쓴다**. 예전엔 양쪽이 각자
 * 리터럴로 정의해, 한쪽만 바꾸면 CAS가 조용히 어긋나고 화면 해석도 갈렸다. 자기 리터럴로
 * 되돌아가는 것을 소스 대조로 막는다.
 */
describe('센티널 정본은 한 곳뿐이다', () => {
  const CONSUMERS = ['lib/booking/confirm.ts', 'lib/funding/confirm.ts'];

  it.each(CONSUMERS)('%s는 센티널을 리터럴로 다시 정의하지 않는다', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf-8');
    expect(source).toMatch(/from '\.\.\/ops\/notificationSentinel'/);
    expect(source).not.toMatch(/const SEND_(PENDING|INFLIGHT)\s*=\s*'/);
  });
});
