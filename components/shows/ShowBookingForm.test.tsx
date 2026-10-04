import { act, fireEvent, render, screen } from '@testing-library/react';

import type { PublicShow } from '../../lib/shows/queries';
import ShowBookingForm from './ShowBookingForm';

const mockUseToss = jest.fn((_amount: number, _enabled?: boolean) => ({
  methodsId: 'm', agreementId: 'a', ready: true, error: null, retry: jest.fn(), requestPayment: jest.fn(), agreedRequiredTerms: null,
}));
jest.mock('../booking/useTossPaymentWidgets', () => ({
  useTossPaymentWidgets: (amount: number, enabled?: boolean) => mockUseToss(amount, enabled),
}));
jest.mock('../../utils/reportPaymentFailure', () => ({ reportPaymentWindowOpen: jest.fn() }));

const showtime = (id: string, label: string) => ({ id, startsAt: 2000000000, label, saleState: 'open' as const, remaining: { tt1: 30, tt2: 30 } });
const ticket = (id: string, name: string, price: number) => ({ id, name, price, zoneLabel: '비지정석' });

const base: PublicShow = {
  slug: 's', title: '공연', subtitle: null, presenterName: '주최', performers: [{ name: '출연' }], ageRating: '전체', runningMinutes: 100,
  venueName: '장소', venueAddress: '주소', description: '소개', coverImage: null, ogImage: null, scheduleNote: null, onSitePriceNote: null, notices: [], mapLinks: {}, cancelled: false,
  ticketTypes: [ticket('tt1', '사전 예매', 25000)],
  showtimes: [showtime('st1', '10.24(토) 18:30')],
};

describe('ShowBookingForm — 동의·선택 최소화', () => {
  it('체크박스를 두지 않고, 결제하기를 누르면 동의하는 것으로 본다는 고지 한 줄만 둔다', () => {
    render(<ShowBookingForm show={base} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText(/결제하기를 누르면 취소·환불 규정과/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '개인정보 처리방침' }).getAttribute('href')).toBe('/ko/privacy-policy');
    // 취소·환불 규정은 접혀 있다 — 열어야 표가 보인다.
    expect(screen.getByText('취소·환불 규정 보기')).toBeTruthy();
  });

  it('회차와 티켓이 하나뿐이면 라디오 대신 요약 한 줄을 보여 준다', () => {
    render(<ShowBookingForm show={base} />);
    // 결제수단(카드·간편결제 / 계좌 입금) 라디오는 빼고 센다 — 회차·티켓 라디오가 없어야 한다.
    expect(screen.queryAllByRole('radio').filter((r) => r.getAttribute('name') !== 'show-paymethod')).toHaveLength(0);
    expect(screen.getByText('10.24(토) 18:30')).toBeTruthy();
    expect(screen.getByText(/사전 예매 25,000원/)).toBeTruthy();
  });

  it('회차나 티켓이 여럿이면 고르게 한다', () => {
    render(
      <ShowBookingForm
        show={{ ...base, ticketTypes: [ticket('tt1', '일반', 20000), ticket('tt2', '후원', 30000)], showtimes: [showtime('st1', '10.24(토) 18:30'), showtime('st2', '10.25(일) 18:30')] }}
      />,
    );
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('name') !== 'show-paymethod')).toHaveLength(4);
  });
});

describe('ShowBookingForm — 결제 위젯 지연 로드', () => {
  type IoCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
  let trigger: IoCallback = () => {};
  const lastEnabled = () => mockUseToss.mock.calls[mockUseToss.mock.calls.length - 1][1];

  beforeEach(() => {
    mockUseToss.mockClear();
    class FakeIO {
      constructor(cb: IoCallback) {
        trigger = cb;
      }
      observe() {}
      disconnect() {}
    }
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO;
  });

  it('폼이 화면 근처에 오기 전에는 위젯을 켜지 않고, 오면 켠다 — 한 번 켠 뒤에는 되돌리지 않는다', () => {
    render(<ShowBookingForm show={base} />);
    expect(lastEnabled()).toBe(false);
    act(() => trigger([{ isIntersecting: false }]));
    expect(lastEnabled()).toBe(false);
    act(() => trigger([{ isIntersecting: true }]));
    expect(lastEnabled()).toBe(true);
    act(() => trigger([{ isIntersecting: false }]));
    expect(lastEnabled()).toBe(true);
  });

  it('폼 안에 포커스가 들어와도 켠다(키보드 이동·앵커 점프)', () => {
    render(<ShowBookingForm show={base} />);
    expect(lastEnabled()).toBe(false);
    fireEvent.focusIn(screen.getByRole('form', { name: '티켓 예매' }));
    expect(lastEnabled()).toBe(true);
  });

  it('IntersectionObserver가 없는 환경에서는 기다리지 않고 바로 켠다', () => {
    (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = undefined;
    render(<ShowBookingForm show={base} />);
    expect(lastEnabled()).toBe(true);
  });
});

describe('ShowBookingForm — 계좌로 직접 입금', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '이관객' } });
    fireEvent.change(screen.getByLabelText(/휴대폰 번호/), { target: { value: '010-1111-2222' } });
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 'fan@example.com' } });
  };

  it('계좌를 고르면 토스 위젯을 숨기고(언마운트하지 않는다) 버튼이 "계좌 안내 받기"가 된다', () => {
    const { container } = render(<ShowBookingForm show={base} />);
    fireEvent.click(screen.getByRole('radio', { name: /계좌로 직접 입금/ }));
    expect(container.querySelector('#m')?.closest('[hidden]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /계좌 안내 받기/ })).toBeTruthy();
    expect(screen.getByText(/계좌 안내 받기를 누르면 취소·환불 규정과/)).toBeTruthy();
  });

  it('계좌 입금 신청은 paymentMethod를 실어 보내고 내 티켓(입금 안내)으로 문서 이동한다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ ok: true, manageUrl: '/ko/shows/manage/TKT-1?token=t' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const assign = jest.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, assign, origin: 'http://localhost' }, writable: true });
    render(<ShowBookingForm show={base} />);
    fill();
    fireEvent.click(screen.getByRole('radio', { name: /계좌로 직접 입금/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /계좌 안내 받기/ }));
    });
    // 첫 호출은 잔여석 재조회(/api/shows/availability)다 — 주문 생성 호출을 골라 본다.
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/shows/orders');
    const body = JSON.parse(call![1].body);
    expect(body.paymentMethod).toBe('bank_transfer');
    expect(assign).toHaveBeenCalledWith('/ko/shows/manage/TKT-1?token=t');
  });

  it('회차 시작이 2시간 안이면 계좌 줄을 막고 이유를 보인다(서버와 같은 판정)', () => {
    const soon = Math.floor(Date.now() / 1000) + 60 * 60;
    render(<ShowBookingForm show={{ ...base, showtimes: [{ ...showtime('st1', '오늘'), startsAt: soon }] }} />);
    const bank = screen.getByRole('radio', { name: /계좌로 직접 입금/ }) as HTMLInputElement;
    expect(bank.disabled).toBe(true);
    expect(screen.getByText(/2시간이 남지 않아 계좌 입금은 받지 않습니다/)).toBeTruthy();
  });
});
