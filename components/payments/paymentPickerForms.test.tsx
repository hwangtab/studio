import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PledgeWizard from '../funding/PledgeWizard';
import BookingWizard from '../booking/BookingWizard';
import MixingOrderWizard from '../booking/MixingOrderWizard';
import ShowBookingForm from '../shows/ShowBookingForm';
import { parseFundingProject } from '../../lib/funding/projects';
import type { SessionProduct } from '../../lib/booking/products';
import type { PublicShow } from '../../lib/shows/queries';

/**
 * 새 결제 화면(기능 플래그 `?pay=v2`)에서 네 폼이 우리가 그린 결제수단 목록을 보이고, 고른 수단의
 * 결제창을 **API 개별 연동 키**로 여는지 본다. 위젯 훅은 진짜 구현을 쓰되 켜지지 않아야 한다.
 */
const sdkRequestPayment = jest.fn().mockResolvedValue(undefined);
const sdkPayment = jest.fn(() => ({ requestPayment: sdkRequestPayment }));
const sdkWidgets = jest.fn();
const loadTossPayments = jest.fn(async (_key: string) => ({ payment: sdkPayment, widgets: sdkWidgets }));
jest.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: '@@ANONYMOUS',
  loadTossPayments: (key: string) => loadTossPayments(key),
}));
jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn(), trackEvent: jest.fn() }));

const savedKey = process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY;
beforeEach(() => {
  process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY = 'live_ck_test';
  window.history.replaceState({}, '', '/ko/test?pay=v2');
  window.sessionStorage.clear();
  sdkRequestPayment.mockClear();
  sdkPayment.mockClear();
  sdkWidgets.mockClear();
  loadTossPayments.mockClear();
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY;
  else process.env.NEXT_PUBLIC_TOSS_API_CLIENT_KEY = savedKey;
  document.cookie = 'studio_pay=; path=/; max-age=0';
  window.history.replaceState({}, '', '/');
  jest.restoreAllMocks();
});

const lastRequest = () => sdkRequestPayment.mock.calls.at(-1)![0];

const expectPicker = async (groupName = '결제수단') => {
  const group = await screen.findByRole('group', { name: groupName });
  const radios = within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'));
  // 토스 계좌이체는 없다. 애플페이는 ApplePaySession이 없는 jsdom에서 보이지 않는다.
  expect(radios).toEqual(['신용·체크카드', '계좌로 직접 입금', '카카오페이', '네이버페이', '토스페이', '페이코']);
  expect(within(group).getByAltText('카카오페이')).toBeInTheDocument();
  return group;
};

describe('PledgeWizard — 결제수단 목록', () => {
  const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 201, headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, orderNo: 'FND-1', totalAmount: 5000, manageUrl: '/ko/funding/manage/FND-1?token=t' }),
    }) as never;
  });

  const fill = async () => {
    await userEvent.type(screen.getByLabelText(/^이름\*$/), '김후원');
    await userEvent.type(screen.getByLabelText(/^연락처\*$/), '010-1111-2222');
    await userEvent.type(screen.getByLabelText(/^이메일\*$/), 'a@b.com');
  };

  it('위젯을 붙이지 않고 목록을 그린다 — 쿠키에 기억한다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ mail: null }} />);
    await expectPicker();
    expect(sdkWidgets).not.toHaveBeenCalled();
    expect(document.cookie).toContain('studio_pay=v2');
  });

  it('카카오페이를 고르면 그 결제창으로 직행하고, 승인 표식(tosskey=api)을 success 주소에 싣는다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ mail: null }} />);
    await fill();
    await userEvent.click(await screen.findByRole('radio', { name: '카카오페이' }));
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(sdkRequestPayment).toHaveBeenCalled());
    expect(loadTossPayments).toHaveBeenCalledWith('live_ck_test');
    expect(sdkPayment).toHaveBeenCalledWith({ customerKey: 'FND-1' });
    expect(lastRequest()).toEqual(expect.objectContaining({
      method: 'CARD', orderId: 'FND-1', amount: { currency: 'KRW', value: 5000 },
      card: { flowMode: 'DIRECT', easyPay: '카카오페이' },
    }));
    expect(lastRequest().successUrl).toBe('http://localhost/ko/funding/success?tosskey=api');
  });

  it('카드는 flowMode 없이(카드 결제창) 연다', async () => {
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ mail: null }} />);
    await fill();
    await screen.findByRole('group', { name: '결제수단' });
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(sdkRequestPayment).toHaveBeenCalled());
    expect(lastRequest().method).toBe('CARD');
    expect(lastRequest().card).toBeUndefined();
  });

  it('계좌로 직접 입금은 토스를 부르지 않고 신청을 만든다 — 버튼은 "계좌 안내 받기"', async () => {
    const assign = jest.fn();
    const realLocation = window.location;
    Object.defineProperty(window, 'location', { value: { ...realLocation, assign, search: '?pay=v2', origin: 'http://localhost' }, configurable: true });
    try {
      render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ mail: null }} />);
      await fill();
      await userEvent.click(await screen.findByRole('radio', { name: '계좌로 직접 입금' }));
      await userEvent.click(screen.getByRole('button', { name: /계좌 안내 받기/ }));
      await waitFor(() => expect(assign).toHaveBeenCalled());
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.paymentMethod).toBe('bank_transfer');
      expect(sdkRequestPayment).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
    }
  });

  it('결제창을 닫으면(USER_CANCEL) 아무 문구도 띄우지 않는다', async () => {
    sdkRequestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }));
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ mail: null }} />);
    await fill();
    await screen.findByRole('group', { name: '결제수단' });
    await userEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(sdkRequestPayment).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BookingWizard — 결제수단 목록', () => {
  const PRODUCT: SessionProduct = {
    id: 'recording-pro', service: 'recording', nameKo: '보컬 녹음 1프로', kind: 'package', unitAmount: 250000, sessionHours: 3,
  };
  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/bookings/slots')) return { ok: true, status: 200, json: async () => ({ ok: true, slots: [{ startHour: 10, available: true }] }) } as Response;
      return { ok: true, status: 201, json: async () => ({ ok: true, orderNo: 'SNB-1', itemAmount: 250000, vatAmount: 25000, totalAmount: 275000 }) } as Response;
    }) as unknown as typeof fetch;
  });

  it('네이버페이를 고르면 그 결제창을 서버 금액으로 연다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await user.click(screen.getByRole('button', { name: '다음: 날짜·시간 선택' }));
    fireEvent.change(screen.getByLabelText('날짜'), { target: { value: '2026-10-01' } });
    await user.click(await screen.findByRole('button', { name: '10:00' }));
    await user.click(screen.getByRole('button', { name: '다음: 예약자 정보' }));
    await user.type(await screen.findByLabelText(/^이름/), '김고객');
    await user.type(screen.getByLabelText(/휴대폰/), '010-1111-2222');
    await user.type(screen.getByLabelText(/이메일/), 'a@b.com');
    await expectPicker();
    await user.click(screen.getByRole('radio', { name: '네이버페이' }));
    await user.click(screen.getByRole('button', { name: '결제하기' }));
    await waitFor(() => expect(sdkRequestPayment).toHaveBeenCalled());
    expect(lastRequest()).toEqual(expect.objectContaining({
      orderId: 'SNB-1', amount: { currency: 'KRW', value: 275000 }, card: { flowMode: 'DIRECT', easyPay: '네이버페이' },
    }));
    expect(lastRequest().successUrl).toBe('http://localhost/ko/booking/success?tosskey=api');
    expect(lastRequest().failUrl).toContain('/ko/booking/fail?service=recording');
    expect(sdkWidgets).not.toHaveBeenCalled();
  });
});

describe('MixingOrderWizard — 결제수단 목록', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true, status: 201, json: async () => ({ ok: true, orderNo: 'SNM-1', itemAmount: 250000, vatAmount: 25000, totalAmount: 275000 }),
    })) as unknown as typeof fetch;
  });

  it('토스페이를 고르면 그 결제창으로 직행한다', async () => {
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await user.click(screen.getByRole('button', { name: '다음: 주문자 정보' }));
    await user.type(await screen.findByLabelText(/^이름/), '김고객');
    await user.type(screen.getByLabelText(/휴대폰/), '010-1111-2222');
    await user.type(screen.getByLabelText(/이메일/), 'a@b.com');
    await expectPicker();
    await user.click(screen.getByRole('radio', { name: '토스페이' }));
    await user.click(screen.getByRole('button', { name: '결제하기' }));
    await waitFor(() => expect(sdkRequestPayment).toHaveBeenCalled());
    expect(lastRequest().card).toEqual({ flowMode: 'DIRECT', easyPay: '토스페이' });
    expect(lastRequest().successUrl).toBe('http://localhost/ko/booking/success?tosskey=api');
  });
});

describe('ShowBookingForm — 결제수단 목록', () => {
  const show: PublicShow = {
    slug: 's', title: '공연', subtitle: null, presenterName: '주최', performers: [{ name: '출연' }], ageRating: '전체', runningMinutes: 100,
    venueName: '장소', venueAddress: '주소', description: '소개', coverImage: null, ogImage: null, scheduleNote: null, onSitePriceNote: null,
    notices: [], mapLinks: {}, cancelled: false,
    ticketTypes: [{ id: 'tt1', name: '사전 예매', price: 25000, zoneLabel: '비지정석' }],
    showtimes: [{ id: 'st1', startsAt: 2000000000, label: '10.24(토) 18:30', saleState: 'open', remaining: { tt1: 30 } }],
  };

  it('페이코를 고르면 그 결제창으로 직행한다', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/shows/orders') return { ok: true, status: 201, json: async () => ({ ok: true, orderNo: 'TKT-20261024-ABCDEFGH', totalAmount: 25000 }) } as Response;
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;
    render(<ShowBookingForm show={show} />);
    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '이관객' } });
    fireEvent.change(screen.getByLabelText(/휴대폰 번호/), { target: { value: '010-1111-2222' } });
    fireEvent.change(screen.getByLabelText(/이메일/), { target: { value: 'fan@example.com' } });
    await expectPicker();
    fireEvent.click(screen.getByRole('radio', { name: '페이코' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /결제하기/ }));
    });
    await waitFor(() => expect(sdkRequestPayment).toHaveBeenCalled());
    expect(lastRequest()).toEqual(expect.objectContaining({
      orderId: 'TKT-20261024-ABCDEFGH', amount: { currency: 'KRW', value: 25000 }, card: { flowMode: 'DIRECT', easyPay: '페이코' },
    }));
    expect(lastRequest().successUrl).toBe('http://localhost/ko/shows/success?tosskey=api');
  });
});

describe('플래그가 꺼져 있으면 위젯 그대로', () => {
  it('쿼리·쿠키·env가 없으면 목록을 그리지 않고 위젯(widgets)을 붙인다', async () => {
    window.history.replaceState({}, '', '/ko/test');
    const widgets = {
      setAmount: jest.fn().mockResolvedValue(undefined),
      renderPaymentMethods: jest.fn().mockResolvedValue(undefined),
      renderAgreement: jest.fn().mockResolvedValue({ on: jest.fn() }),
      requestPayment: jest.fn(),
    };
    sdkWidgets.mockReturnValue(widgets);
    const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');
    process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = 'live_gck_test';
    render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ mail: null }} />);
    await waitFor(() => expect(widgets.renderPaymentMethods).toHaveBeenCalled());
    expect(loadTossPayments).toHaveBeenCalledWith('live_gck_test');
    expect(screen.queryByRole('group', { name: '결제수단' })).toBeNull();
    expect(screen.getByRole('radio', { name: /카드·간편결제\(토스\)/ })).toBeInTheDocument();
    delete process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  });
});
