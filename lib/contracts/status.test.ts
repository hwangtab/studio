/** @jest-environment node */

import { contractStatusEnum } from '../../db/schema';
import {
  SIGN_TOKEN_TTL_DAYS,
  checkAction,
  computeExpiresAt,
  getEffectiveStatus,
  getStatusLabel,
  isActionAllowed,
  needsTermination,
  type ContractStatus,
} from './status';

const contract = (status: ContractStatus, expiresAt: Date | null = null) => ({
  status,
  expiresAt,
});

describe('계약 상태 전이 규칙', () => {
  it('작성중 계약만 발송·수정할 수 있다', () => {
    expect(isActionAllowed('draft', 'send')).toBe(true);
    expect(isActionAllowed('draft', 'update')).toBe(true);

    for (const status of ['sent', 'signed', 'cancelled', 'expired'] as ContractStatus[]) {
      expect(isActionAllowed(status, 'send')).toBe(false);
      expect(isActionAllowed(status, 'update')).toBe(false);
    }
  });

  it('서명 완료된 계약은 어떤 변경도 허용하지 않는다', () => {
    for (const action of ['send', 'resend', 'cancel', 'update', 'delete'] as const) {
      expect(isActionAllowed('signed', action)).toBe(false);
    }
  });

  it('발송·만료·취소 상태에서 재발송할 수 있다', () => {
    expect(isActionAllowed('sent', 'resend')).toBe(true);
    expect(isActionAllowed('expired', 'resend')).toBe(true);
    expect(isActionAllowed('cancelled', 'resend')).toBe(true);
    expect(isActionAllowed('draft', 'resend')).toBe(false);
  });

  it('서명은 발송 상태에서만 가능하다', () => {
    expect(isActionAllowed('sent', 'sign')).toBe(true);
    expect(isActionAllowed('draft', 'sign')).toBe(false);
    expect(isActionAllowed('expired', 'sign')).toBe(false);
    expect(isActionAllowed('signed', 'sign')).toBe(false);
  });

  it('삭제는 작성중·취소 상태에서만 가능하다', () => {
    expect(isActionAllowed('draft', 'delete')).toBe(true);
    expect(isActionAllowed('cancelled', 'delete')).toBe(true);
    expect(isActionAllowed('sent', 'delete')).toBe(false);
    expect(isActionAllowed('signed', 'delete')).toBe(false);
  });

  it('거부 시 상태와 동작을 한국어로 설명한다', () => {
    const result = checkAction('signed', 'update');
    expect(result.ok).toBe(false);
    expect(result.message).toBe('서명완료 상태의 계약은 수정할 수 없습니다.');
  });

  it('허용 시 메시지 없이 통과한다', () => {
    expect(checkAction('draft', 'send')).toEqual({ ok: true });
  });
});

describe('서명 링크 만료 판정', () => {
  const now = new Date('2026-07-27T00:00:00.000Z');

  it('만료 시각은 발송 시점으로부터 정해진 일수 뒤다', () => {
    const sentAt = new Date('2026-07-01T09:00:00.000Z');
    const expiresAt = computeExpiresAt(sentAt);
    const diffDays = (expiresAt.getTime() - sentAt.getTime()) / (24 * 60 * 60 * 1000);

    expect(diffDays).toBe(SIGN_TOKEN_TTL_DAYS);
  });

  it('기한이 지난 발송 건은 만료로 본다', () => {
    const past = new Date(now.getTime() - 1000);
    expect(getEffectiveStatus(contract('sent', past), now)).toBe('expired');
  });

  it('기한이 남은 발송 건은 그대로 발송 상태다', () => {
    const future = new Date(now.getTime() + 1000);
    expect(getEffectiveStatus(contract('sent', future), now)).toBe('sent');
  });

  it('만료 시각이 없으면 만료로 보지 않는다', () => {
    expect(getEffectiveStatus(contract('sent', null), now)).toBe('sent');
  });

  it('발송 이외의 상태는 기한이 지나도 바뀌지 않는다', () => {
    const past = new Date(now.getTime() - 1000);
    expect(getEffectiveStatus(contract('signed', past), now)).toBe('signed');
    expect(getEffectiveStatus(contract('draft', past), now)).toBe('draft');
    expect(getEffectiveStatus(contract('cancelled', past), now)).toBe('cancelled');
  });

  it('만료 시각과 정확히 같은 순간은 만료로 처리한다', () => {
    expect(getEffectiveStatus(contract('sent', new Date(now)), now)).toBe('expired');
  });
});

describe('needsTermination — 종료일 당일은 이용 기간', () => {
  // endDate는 UTC 자정(=KST 달력 날짜)으로 저장된다. 2026-09-30 = KST 9/30.
  const endDate = new Date('2026-09-30T00:00:00.000Z');
  const signed = (over: Partial<{ endDate: Date; terminatedAt: Date | null }> = {}) => ({
    status: 'signed' as ContractStatus,
    endDate,
    terminatedAt: null,
    ...over,
  });

  it('종료일 당일 오전(KST)에는 아직 종료 처리가 필요 없다', () => {
    // KST 9/30 09:01 = 2026-09-30T00:01Z. 마지막 날 오전.
    expect(needsTermination(signed(), new Date('2026-09-30T00:01:00.000Z'))).toBe(false);
  });

  it('종료일 당일 밤(KST)에도 아직 이용 기간이다', () => {
    // KST 9/30 23:59 = 2026-09-30T14:59Z.
    expect(needsTermination(signed(), new Date('2026-09-30T14:59:00.000Z'))).toBe(false);
  });

  it('다음 날 0시(KST)를 넘기면 종료 처리가 필요하다', () => {
    // KST 10/1 00:00 = 2026-09-30T15:00Z.
    expect(needsTermination(signed(), new Date('2026-09-30T15:00:00.000Z'))).toBe(true);
  });

  it('며칠 지났으면 당연히 필요하다', () => {
    expect(needsTermination(signed(), new Date('2026-10-05T00:00:00.000Z'))).toBe(true);
  });

  it('종료 처리된 계약은 대상이 아니다', () => {
    expect(
      needsTermination(signed({ terminatedAt: new Date('2026-10-02T00:00:00Z') }), new Date('2026-10-05T00:00:00Z')),
    ).toBe(false);
  });

  it('서명 전 계약은 대상이 아니다', () => {
    expect(
      needsTermination(
        { status: 'sent', endDate, terminatedAt: null },
        new Date('2026-10-05T00:00:00Z'),
      ),
    ).toBe(false);
  });
});

describe('상태 라벨', () => {
  /**
   * 상태 목록을 손으로 나열하면 새 상태를 추가할 때 여기를 빠뜨린다 — 실제로 terminated가
   * 추가됐을 때 이 테스트가 그것을 돌지 않아 "모든 상태에 라벨이 있다"가 거짓이 됐다.
   * 스키마의 enum을 그대로 순회해 앞으로는 CI가 잡게 한다.
   */
  it('모든 상태에 한국어 라벨이 있다', () => {
    for (const status of contractStatusEnum) {
      expect(getStatusLabel(status)).toMatch(/[가-힣]/);
    }
  });

  it('스키마 enum과 라벨 대상이 어긋나지 않는다', () => {
    expect(contractStatusEnum).toContain('terminated');
  });
});
