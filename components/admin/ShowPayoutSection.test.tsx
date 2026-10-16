/**
 * 공연 정산 절 — 지급 뒤 환불로 더 지급된 몫(회수 필요) 안내와 「회수 처리 남기기」가 맞게 나오고, 처리 줄이 덮은 만큼 줄어드는가.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { ShowPayoutSection } from './ShowPayoutSection';
import type { ShowPayoutRecordView, ShowPayoutView } from '../../lib/partnerPayouts/showView';

const record = (over: Partial<ShowPayoutRecordView> = {}): ShowPayoutRecordView => ({
  id: 'rec-1', taxType: 'withholding', status: 'paid', grossAmount: 200000, refundAmount: 0, platformFeeAmount: 11000, paymentFeeAmount: 6600,
  vatDeductionAmount: 16000, shareAmount: 160000, withholdingAmount: 5000, adjustmentAmount: 0, shortfallAmount: 0, netAmount: 155000, itemCount: 2,
  paidAt: '2026-11-20T00:00:00.000Z', memo: '이체함', createdAt: '2026-11-19T00:00:00.000Z', ...over,
});

const view = (over: Partial<ShowPayoutView> = {}): ShowPayoutView => ({
  settleable: true, notSettleableReason: null, creatorId: 'c1', payeeName: '주최자', taxType: 'withholding', ended: true, lastEndAt: 1, dueBy: 2,
  itemCount: 2, grossAmount: 200000, refundAmount: 100000, netSalesAmount: 100000, platformFeeAmount: 5500, paymentFeeAmount: 3300,
  vatDeductionAmount: 8000, shareAmount: 80000, withholdingAmount: 2500, adjustments: [], adjustmentAmount: 0, adjustmentOffsetAmount: 0, shortfallAmount: 0,
  netAmount: 77500, cancelFees: [], refundAccountPendingCount: 0, refundDueCancelledOrderCount: 0, blockers: ['already_recorded'], warnings: [],
  recorded: record(), appliedAdjustments: [], drift: true,
  recordedDelta: { currentNetAmount: 77500, overpaidAmount: 77500, underpaidAmount: 0, acknowledgedAmount: 0, lateRefundOrders: [{ orderNo: 'TKT-9', amount: 100000 }] },
  ...over,
});

let fetchMock: jest.Mock;
let reload: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }) as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
  reload = jest.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
});
afterEach(() => jest.restoreAllMocks());

const renderSection = (v: ShowPayoutView) => render(<ShowPayoutSection showId="s1" panel={{ state: 'ok', view: v }} showtimeLabels={{}} />);

describe('지급 뒤 환불 — 회수 필요 안내', () => {
  it('지급 완료 기록에 초과 지급이 있으면 금액·환불 주문·버튼이 나온다', () => {
    renderSection(view());
    expect(screen.getByText('지급 후 환불로 77,500원 더 지급됐습니다(회수 필요)')).toBeInTheDocument();
    expect(screen.getByText(/TKT-9\(100,000원\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '회수 처리 남기기' })).toBeInTheDocument();
  });

  it('처리 줄이 일부를 덮었으면 남은 몫만 보이고, 전부 덮었으면 안내 박스 대신 처리됨 문구', () => {
    const partial = view({ recorded: record({ memo: '이체함\n[회수 처리 7,500원 · admin · 2026-11-21] 1차' }) });
    const { unmount } = renderSection(partial);
    expect(screen.getByText('지급 후 환불로 70,000원 더 지급됐습니다(회수 필요)')).toBeInTheDocument();
    unmount();

    renderSection(view({ recorded: record({ memo: '[회수 처리 77500원 · admin · 2026-11-21] 전액' }) }));
    expect(screen.queryByText(/회수 필요/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '회수 처리 남기기' })).not.toBeInTheDocument();
    expect(screen.getByText(/회수 처리 메모로 남겨져 있습니다/)).toBeInTheDocument();
  });

  it('이체 전(pending)에는 회수 박스 대신 기록 취소 안내, 초과가 없으면 박스가 없다', () => {
    const { unmount } = renderSection(view({ recorded: record({ status: 'pending' }) }));
    expect(screen.queryByText(/회수 필요/)).not.toBeInTheDocument();
    expect(screen.getByText(/기록 취소/, { selector: 'p' })).toBeInTheDocument();
    unmount();
    renderSection(view({ drift: false, recordedDelta: { currentNetAmount: 155000, overpaidAmount: 0, underpaidAmount: 0, acknowledgedAmount: 0, lateRefundOrders: [] } }));
    expect(screen.queryByText(/회수 필요/)).not.toBeInTheDocument();
  });

  it('지급 뒤 판매가 늘면 부족 안내만 나온다', () => {
    renderSection(view({ recordedDelta: { currentNetAmount: 160000, overpaidAmount: 0, underpaidAmount: 5000, acknowledgedAmount: 0, lateRefundOrders: [] } }));
    expect(screen.getByText(/기록보다 5,000원 많습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/회수 필요/)).not.toBeInTheDocument();
  });

  it('회수 처리 남기기 — 금액과 메모를 물어 acknowledge_overpayment로 부르고 새로고침한다', async () => {
    const prompt = jest.spyOn(window, 'prompt').mockReturnValueOnce('50,000').mockReturnValueOnce('주최자에게 계좌로 반환 요청');
    renderSection(view());
    await userEvent.click(screen.getByRole('button', { name: '회수 처리 남기기' }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(prompt.mock.calls[0][1]).toBe('77500');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/shows/s1/payout');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ action: 'acknowledge_overpayment', payoutId: 'rec-1', amount: 50000, memo: '주최자에게 계좌로 반환 요청' });
  });

  it('메모를 비우거나 금액이 숫자가 아니면 라우트를 부르지 않는다', async () => {
    jest.spyOn(window, 'prompt').mockReturnValueOnce('abc');
    renderSection(view());
    await userEvent.click(screen.getByRole('button', { name: '회수 처리 남기기' }));
    expect(await screen.findByText('금액을 1원 이상의 숫자로 적어 주세요.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
