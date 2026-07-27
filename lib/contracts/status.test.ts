/** @jest-environment node */

import {
  SIGN_TOKEN_TTL_DAYS,
  checkAction,
  computeExpiresAt,
  getEffectiveStatus,
  getStatusLabel,
  isActionAllowed,
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

describe('상태 라벨', () => {
  it('모든 상태에 한국어 라벨이 있다', () => {
    const statuses: ContractStatus[] = ['draft', 'sent', 'signed', 'cancelled', 'expired'];
    for (const status of statuses) {
      expect(getStatusLabel(status)).toMatch(/[가-힣]/);
    }
  });
});
