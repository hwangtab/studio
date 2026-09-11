import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/bookings/o1' }) }));
jest.mock('../../../../components/admin/bookingActions', () => ({
  refundBooking: jest.fn(),
  resendBookingNotification: jest.fn(),
  setBookingStatus: jest.fn(),
  setWorkOrderStage: jest.fn(),
}));
// admin-auth는 iron-session(ESM)을 끌고 들어온다 — getServerSideProps는 이 테스트 대상이 아니다.
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminBookingDetailPage from '../../../../pages/admin/bookings/[id]';
import type { AdminBookingDetail } from '../../../../lib/booking/admin-serialize';

// `as AdminBookingDetail` 대신 타입 주석 — 캐스팅은 신규 필수 필드가 빠져도 컴파일을 통과시킨다.
const SESSION: AdminBookingDetail = {
  id: 'o1', orderNo: 'SNB-1', orderType: 'session', customerName: '홍길동',
  customerPhone: '010-0000-0000', customerEmail: 'a@b.c', productId: 'recording-pro',
  productName: '레코딩', serviceType: 'recording',
  startAt: '2026-09-20T05:00:00.000Z', endAt: '2026-09-20T08:00:00.000Z', durationHours: 3,
  itemAmount: 250000, vatAmount: 25000, totalAmount: 275000, orderStatus: 'paid',
  bookingId: 'b1', bookingStatus: 'confirmed', workOrder: null,
  notificationError: null, gcalError: null, gcalMissing: false,
  paymentCount: 1, latestPaymentKeyPrefix: 'pk123456', mismatch: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  customerNote: null, cancelledAt: null, payment: null, refunds: [],
};

const retryButton = () => screen.queryByRole('button', { name: '캘린더 재시도' });

/**
 * PR #65의 센티널 CAS 선점 직후·ensureBookingEvent 전에 죽은 예약 — gcalEventId·gcalError가
 * 둘 다 NULL이다. 예전엔 재시도 버튼이 gcalError 배너 **안**에만 있어 이 상태에서는 배너도
 * 버튼도 안 떴고, 운영자가 알림 배너를 보고 "알림 재발송"을 누르면 마지막 신호까지 지워졌다.
 */
it('등록 시도 기록이 없는 확정 예약도 캘린더 배너와 재시도 버튼을 띄운다', () => {
  render(<AdminBookingDetailPage booking={{ ...SESSION, gcalMissing: true, notificationError: 'send_inflight' }} />);
  expect(screen.getByText(/등록 시도 기록이 없습니다/)).toBeInTheDocument();
  expect(retryButton()).toBeInTheDocument();
});

it('캘린더 등록에 실패한 예약은 사유와 함께 기존 배너를 유지한다', () => {
  render(<AdminBookingDetailPage booking={{ ...SESSION, gcalError: 'create: 500' }} />);
  expect(screen.getByText(/구글 캘린더 동기화에 실패했습니다/)).toBeInTheDocument();
  expect(screen.getByText(/create: 500/)).toBeInTheDocument();
  expect(retryButton()).toBeInTheDocument();
});

it('정상 등록된 예약에는 캘린더 배너도 재시도 버튼도 없다', () => {
  render(<AdminBookingDetailPage booking={SESSION} />);
  expect(retryButton()).not.toBeInTheDocument();
});

// 대기 예약은 아직 확정되지 않아 캘린더에 넣을 것이 없다 — gcalMissing이 confirmed에서만
// 참이므로 여기서 버튼이 새로 뜨면 안 된다.
it('결제 대기 예약에는 캘린더 재시도 버튼이 뜨지 않는다', () => {
  render(<AdminBookingDetailPage booking={{ ...SESSION, bookingStatus: 'pending', orderStatus: 'pending' }} />);
  expect(retryButton()).not.toBeInTheDocument();
});

// 취소된 예약의 캘린더 오류(삭제 실패)는 배너로 알리되 재등록 버튼은 주지 않는다 — 기존 판정.
it('취소된 예약은 배너만 남고 재시도 버튼은 없다', () => {
  render(<AdminBookingDetailPage booking={{ ...SESSION, bookingStatus: 'cancelled', gcalError: 'delete: 500' }} />);
  expect(screen.getByText(/구글 캘린더 동기화에 실패했습니다/)).toBeInTheDocument();
  expect(retryButton()).not.toBeInTheDocument();
});

// 믹싱·마스터링 주문은 bookings 행이 없어 캘린더 개념 자체가 없다(API도 409를 준다).
it('믹싱 주문에는 캘린더 배너·버튼이 뜨지 않는다', () => {
  render(
    <AdminBookingDetailPage
      booking={{
        ...SESSION, orderType: 'mixing', bookingId: null, bookingStatus: null,
        startAt: null, endAt: null, durationHours: null, gcalError: null, gcalMissing: false,
        notificationError: 'send_inflight',
        workOrder: { id: 'w1', status: 'received', songCount: 2, vocalTuning: false, startedAt: null, deliveredAt: null },
      }}
    />,
  );
  expect(retryButton()).not.toBeInTheDocument();
});

/**
 * 센티널 노출 회귀 — `notification_error`에는 실제 실패 사유만이 아니라 후처리 소유권 CAS가
 * 쓰는 예약어(`send_pending`·`send_inflight`)가 들어온다. 원문을 그대로 찍으면
 * "알림 발송에 실패했습니다 send_inflight"가 되어, 정상 진행 중인 주문을 사고로 읽게 만든다.
 */
describe('알림 배너는 센티널 원문을 노출하지 않는다', () => {
  it.each(['send_pending', 'send_inflight'])('%s를 화면에 그대로 찍지 않는다', (sentinel) => {
    const { container } = render(
      <AdminBookingDetailPage booking={{ ...SESSION, notificationError: sentinel }} />,
    );
    expect(container.textContent).not.toContain(sentinel);
    // 센티널은 실패가 아니다 — "실패했습니다"라고 말하면 거짓이다.
    expect(screen.queryByText('알림 발송에 실패했습니다')).not.toBeInTheDocument();
  });

  it('실제 실패 사유는 원문 그대로 보여준다', () => {
    render(
      <AdminBookingDetailPage
        booking={{ ...SESSION, notificationError: 'Resend 550: rejected' }}
      />,
    );
    expect(screen.getByText('알림 발송에 실패했습니다')).toBeInTheDocument();
    expect(screen.getByText(/Resend 550: rejected/)).toBeInTheDocument();
  });

  /**
   * 믹싱 주문에는 "알림 재발송" 버튼이 없다(bookings 행이 없어 API도 409를 준다).
   * 그런데 배너는 "아래 알림 재발송을 눌러 주세요"라고 말하고 있었다 — 없는 버튼을
   * 가리키면 운영자가 화면을 뒤지다 포기한다.
   */
  it('재발송 버튼이 없는 주문에는 그 버튼을 가리키지 않는다', () => {
    render(
      <AdminBookingDetailPage
        booking={{
          ...SESSION, orderType: 'mixing', bookingId: null, bookingStatus: null,
          startAt: null, endAt: null, durationHours: null, gcalMissing: false,
          notificationError: 'Resend 550: rejected',
          workOrder: { id: 'w1', status: 'received', songCount: 2, vocalTuning: false, startedAt: null, deliveredAt: null },
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: '알림 재발송' })).not.toBeInTheDocument();
    expect(screen.getByText(/재발송 버튼이 없습니다/)).toBeInTheDocument();
  });
});
