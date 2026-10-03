import {
  classifyContractNotificationError,
  describeOperatorAlertFailure,
  needsCustomerNotificationFollowUp,
  NOTIFICATION_ERROR_SEPARATOR,
} from './notification-error';

describe('계약 알림 실패 판정', () => {
  it('비어 있으면 none', () => {
    expect(classifyContractNotificationError(null)).toBe('none');
    expect(classifyContractNotificationError('')).toBe('none');
  });

  it('운영자 알림 실패만 있으면 operator_only — 쓰는 쪽(service·finalize)과 같은 문구로 확인', () => {
    expect(classifyContractNotificationError(describeOperatorAlertFailure('RATE_LIMIT'))).toBe('operator_only');
    expect(classifyContractNotificationError(describeOperatorAlertFailure(undefined))).toBe('operator_only');
  });

  it('고객 쪽 실패가 하나라도 섞이면 customer', () => {
    const mixed = ['서명 요청 메일 발송 실패 (X)', describeOperatorAlertFailure('Y')].join(NOTIFICATION_ERROR_SEPARATOR);
    expect(classifyContractNotificationError(mixed)).toBe('customer');
    expect(
      classifyContractNotificationError(['PDF 생성 실패', describeOperatorAlertFailure('Y')].join(NOTIFICATION_ERROR_SEPARATOR)),
    ).toBe('customer');
    expect(classifyContractNotificationError('서명 요청 메일 발송 중 오류가 발생했습니다.')).toBe('customer');
  });

  it('알 수 없는 문구는 고객 실패로 본다 — 놓치는 쪽이 위험하다', () => {
    expect(classifyContractNotificationError('x')).toBe('customer');
  });

  describe('운영 점검 대상', () => {
    const base = { status: 'sent', purgedAt: null, notificationError: '서명 요청 메일 발송 실패 (X)' };

    it('고객 쪽 실패가 있는 진행 중 계약은 대상', () => {
      expect(needsCustomerNotificationFollowUp(base)).toBe(true);
      expect(needsCustomerNotificationFollowUp({ ...base, status: 'signed' })).toBe(true);
    });

    it('운영자 알림만 실패했으면 대상이 아니다', () => {
      expect(needsCustomerNotificationFollowUp({ ...base, notificationError: describeOperatorAlertFailure('X') })).toBe(false);
    });

    it('취소·만료·파기된 계약은 대상이 아니다', () => {
      expect(needsCustomerNotificationFollowUp({ ...base, status: 'cancelled' })).toBe(false);
      expect(needsCustomerNotificationFollowUp({ ...base, status: 'expired' })).toBe(false);
      expect(needsCustomerNotificationFollowUp({ ...base, purgedAt: new Date() })).toBe(false);
    });
  });
});
