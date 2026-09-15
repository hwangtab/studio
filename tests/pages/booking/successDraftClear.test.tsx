import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import BookingSuccessPage from '../../../pages/[locale]/booking/success';
import { BOOKING_CUSTOMER_DRAFT_KEY, MIXING_CUSTOMER_DRAFT_KEY } from '../../../lib/booking/customerDraft';

/**
 * 결제가 확정된 화면(success.test.tsx는 getServerSideProps만 다룬다 — 여기는 렌더된
 * 컴포넌트가 sessionStorage를 실제로 지우는지를 본다)에서, BookingWizard·MixingOrderWizard가
 * 남긴 이름·연락처 임시 저장(lib/formDraft.ts)이 계속 남아 있을 이유가 없다.
 *
 * `orderType`으로 이번 결제가 예약(session)인지 믹싱 주문인지 알 수 있으므로, 그 흐름의
 * 초안만 지운다 — 다른 흐름의 초안(같은 사람이 동시에 진행 중이던 것)까지 지우면 안 된다.
 */

beforeEach(() => window.sessionStorage.clear());

const seedBoth = () => {
  window.sessionStorage.setItem(BOOKING_CUSTOMER_DRAFT_KEY, JSON.stringify({ customerName: '홍길동' }));
  window.sessionStorage.setItem(MIXING_CUSTOMER_DRAFT_KEY, JSON.stringify({ customerName: '김믹싱' }));
};

describe('예약 완료 화면 — 임시 저장 정리', () => {
  it('세션 예약이 확정되면 예약 초안만 지운다', () => {
    seedBoth();
    render(<BookingSuccessPage outcome="confirmed" orderNo="SNB-1" orderType="session" />);

    expect(window.sessionStorage.getItem(BOOKING_CUSTOMER_DRAFT_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(MIXING_CUSTOMER_DRAFT_KEY)).not.toBeNull();
  });

  it('믹싱 주문이 확정되면 믹싱 초안만 지운다', () => {
    seedBoth();
    render(<BookingSuccessPage outcome="confirmed" orderNo="SNM-1" orderType="mixing" />);

    expect(window.sessionStorage.getItem(MIXING_CUSTOMER_DRAFT_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(BOOKING_CUSTOMER_DRAFT_KEY)).not.toBeNull();
  });

  it('결제 확정에 실패한 화면에서는 초안을 건드리지 않는다', () => {
    seedBoth();
    render(<BookingSuccessPage outcome="error" message="실패" />);

    expect(window.sessionStorage.getItem(BOOKING_CUSTOMER_DRAFT_KEY)).not.toBeNull();
    expect(window.sessionStorage.getItem(MIXING_CUSTOMER_DRAFT_KEY)).not.toBeNull();
  });
});
