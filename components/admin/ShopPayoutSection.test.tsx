/**
 * 상점 아티스트 정산 표 — 버튼이 상태별로 맞게 나오는가, 계좌는 props가 아니라 버튼 클릭 때만 개설자 단위 라우트에서 오는가,
 * 기록·지급 완료·취소가 확인창을 거쳐 올바른 본문으로 라우트를 부르는가.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { ShopPayoutSection } from './ShopPayoutSection';
import type { PayoutRecordView, ShopPayoutRowView } from '../../lib/partnerPayouts/shopView';

const baseRow = (over: Partial<ShopPayoutRowView> = {}): ShopPayoutRowView => ({
  subjectKey: 'creator:c1', period: '2026-10', payeeName: '김아티스트', creatorId: 'c1', taxType: 'withholding',
  itemCount: 2, salesAmount: 40000, shippingAmount: 0, shippingOrderCount: 0, storeAmount: 18000, vatDeductionAmount: 2000,
  shareAmount: 20000, withholdingAmount: 660, adjustments: [], adjustmentAmount: 0, carryOverAmount: 0, netAmount: 19340,
  needsReviewOrderNos: [], withdrawableOrderCount: 0, blockers: [], warnings: [], recorded: null, appliedAdjustments: [], drift: false,
  ...over,
});

const record = (over: Partial<PayoutRecordView> = {}): PayoutRecordView => ({
  id: 'rec-1', taxType: 'withholding', status: 'pending', grossAmount: 40000, shippingAmount: 0, studioAmount: 18000, vatDeductionAmount: 2000,
  shareAmount: 20000, withholdingAmount: 660, adjustmentAmount: 0, shortfallAmount: 0, netAmount: 19340, itemCount: 2, paidAt: null, memo: null,
  createdAt: '2026-11-05T00:00:00.000Z', ...over,
});

const renderSection = (rows: ShopPayoutRowView[]) =>
  render(<ShopPayoutSection rows={rows} month="2026-10" prevMonth="2026-09" nextMonth="2026-11" otherAdjustments={[]} />);

let fetchMock: jest.Mock;
let reload: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async (url: string) => {
    if (url.endsWith('/payout-account')) {
      return { ok: true, json: async () => ({ ok: true, account: { bankName: '국민은행', account: '123-456-789012', holder: '김아티스트' } }) } as Response;
    }
    return { ok: true, json: async () => ({ ok: true }) } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  reload = jest.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

const postBodies = () => fetchMock.mock.calls
  .filter(([url]) => url === '/api/admin/shop/payouts')
  .map(([, init]) => JSON.parse((init as RequestInit).body as string));

describe('미기록 행', () => {
  it('정산 기록을 누르면 확인 뒤 화면이 본 금액을 expected로 실어 기록 액션을 부른다', async () => {
    renderSection([baseRow()]);
    await userEvent.click(screen.getByRole('button', { name: '정산 기록' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('19,340원'));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(postBodies()).toEqual([{ action: 'record', subjectKey: 'creator:c1', period: '2026-10', expected: { netAmount: 19340, adjustmentAmount: 0 } }]);
  });

  it('확인창에서 취소하면 아무것도 부르지 않는다', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    renderSection([baseRow()]);
    await userEvent.click(screen.getByRole('button', { name: '정산 기록' }));
    expect(postBodies()).toEqual([]);
  });

  it('막는 조건이 있으면 기록 버튼이 비활성이고 사유가 보인다. 주민등록번호 미등록은 경고일 뿐이다', () => {
    renderSection([baseRow({ blockers: ['no_payout_account', 'terms_not_agreed'], warnings: ['no_resident_number'] })]);
    expect(screen.getByRole('button', { name: '정산 기록' })).toBeDisabled();
    expect(screen.getByText('정산 계좌가 등록되지 않았습니다')).toBeInTheDocument();
    expect(screen.getByText('상점 위탁 약관 현재 판본에 동의하지 않았습니다')).toBeInTheDocument();
    expect(screen.getByText(/주민등록번호 미등록/)).toBeInTheDocument();
  });

  it('주민등록번호 미등록만 있으면 기록할 수 있다', () => {
    renderSection([baseRow({ warnings: ['no_resident_number'] })]);
    expect(screen.getByRole('button', { name: '정산 기록' })).toBeEnabled();
  });

  it('이월 조정과 음수 이월이 보인다', () => {
    renderSection([baseRow({
      adjustmentAmount: -30000, carryOverAmount: -8000, netAmount: 0,
      adjustments: [{ id: 'a1', payeeKey: 'creator:c1', amount: -30000, reason: 'late_refund', sourceRef: 'SHP-9', memo: '주문 SHP-9 환불', deletable: false, createdAt: '2026-11-10T00:00:00.000Z' }],
    })]);
    expect(screen.getByText(/이월 조정 −30,000원/)).toBeInTheDocument();
    expect(screen.getByText(/정산 뒤 환불 −30,000원/)).toBeInTheDocument();
    expect(screen.getByText(/8,000원은 다음 정산으로 이월됩니다/)).toBeInTheDocument();
  });
});

describe('기록된 행', () => {
  it('이체 전(pending): 지급 완료·기록 취소가 있다. 지급 완료는 메모를 묻고 mark_paid로 부른다', async () => {
    renderSection([baseRow({ recorded: record() })]);
    expect(screen.queryByRole('button', { name: '정산 기록' })).not.toBeInTheDocument();
    expect(screen.getByText('이체 대기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '기록 취소(이체 전)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '지급 완료' }));
    // 메모는 입력창 겸 확인창(useAdminDialog)이 받는다 — 예전 window.prompt + confirm 두 번.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('19,340원');
    await userEvent.type(within(dialog).getByLabelText('이체 메모 (선택)'), '10/30 이체 19,340원');
    await userEvent.click(within(dialog).getByRole('button', { name: '지급 완료로 기록' }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(postBodies()).toEqual([{ action: 'mark_paid', id: 'rec-1', memo: '10/30 이체 19,340원' }]);
  });

  it('지급 완료 메모 입력을 취소하면 요청하지 않는다', async () => {
    renderSection([baseRow({ recorded: record() })]);
    await userEvent.click(screen.getByRole('button', { name: '지급 완료' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(postBodies()).toEqual([]);
  });

  it('기록 취소는 확인 뒤 delete 액션', async () => {
    renderSection([baseRow({ recorded: record() })]);
    await userEvent.click(screen.getByRole('button', { name: '기록 취소(이체 전)' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('조정은 풀립니다'));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(postBodies()).toEqual([{ action: 'delete', id: 'rec-1' }]);
  });

  it('지급 완료된 기록에는 지급 완료·기록 취소 버튼이 없다', () => {
    renderSection([baseRow({ recorded: record({ status: 'paid', paidAt: '2026-11-08T03:00:00.000Z', memo: '11/8 이체' }) })]);
    expect(screen.queryByRole('button', { name: '지급 완료' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '기록 취소(이체 전)' })).not.toBeInTheDocument();
    expect(screen.getByText('메모: 11/8 이체')).toBeInTheDocument();
  });

  it('기록 뒤 판매액이 바뀌면(뒤늦은 환불) 알린다', () => {
    renderSection([baseRow({ recorded: record(), salesAmount: 0, drift: true })]);
    expect(screen.getByText(/기록 뒤 판매액이 바뀌었습니다/)).toBeInTheDocument();
  });

  it('기록된 행은 기록의 이체액을 보인다(지금 계산이 아니라)', () => {
    renderSection([baseRow({ netAmount: 1, recorded: record({ netAmount: 19340 }) })]);
    expect(screen.getByText('19,340원')).toBeInTheDocument();
  });
});

describe('계좌 보기', () => {
  it('props에는 계좌가 없고, 누른 순간에만 개설자 단위 경로에서 받아 보인다', async () => {
    renderSection([baseRow()]);
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '계좌 보기' }));
    expect(await screen.findByText(/123-456-789012/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/creators/c1/payout-account', { credentials: 'same-origin' });
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByText(/123-456-789012/)).not.toBeInTheDocument();
  });

  it('서버가 거절하면 사유를 보인다', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, message: '등록된 정산 계좌가 없습니다.' }) } as Response);
    renderSection([baseRow()]);
    await userEvent.click(screen.getByRole('button', { name: '계좌 보기' }));
    expect(await screen.findByText('등록된 정산 계좌가 없습니다.')).toBeInTheDocument();
  });

  it('파일 갈래 아티스트(creatorId 없음)에는 계좌 보기 버튼이 없지만 기록·지급 완료는 된다', () => {
    renderSection([baseRow({ subjectKey: 'file:fa', creatorId: null, payeeName: '파일 아티스트', taxType: 'invoice' })]);
    expect(screen.queryByRole('button', { name: '계좌 보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '정산 기록' })).toBeEnabled();
    expect(screen.getByText(/계정 없음/)).toBeInTheDocument();
  });
});

describe('수기 조정', () => {
  it('금액·사유를 묻고 add_adjustment로 부른다', async () => {
    renderSection([baseRow()]);
    await userEvent.click(screen.getByRole('button', { name: '조정 추가' }));
    const dialog = screen.getByRole('dialog');
    // 0이 아닌 정수가 아니면 창 안에서 막는다.
    await userEvent.click(within(dialog).getByRole('button', { name: '조정 추가' }));
    expect(within(dialog).getByText('0이 아닌 정수 금액을 입력해 주세요.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/조정 금액/), '-5000');
    await userEvent.type(within(dialog).getByLabelText(/조정 사유/), '선지급 상계');
    await userEvent.click(within(dialog).getByRole('button', { name: '조정 추가' }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(postBodies()).toEqual([{ action: 'add_adjustment', subjectKey: 'creator:c1', amount: -5000, memo: '선지급 상계' }]);
  });

  it('수기 조정만 삭제 버튼이 있다', () => {
    renderSection([baseRow({
      adjustments: [
        { id: 'a1', payeeKey: 'creator:c1', amount: -100, reason: 'late_refund', sourceRef: 'SHP-1', memo: null, deletable: false, createdAt: '2026-11-10T00:00:00.000Z' },
        { id: 'a2', payeeKey: 'creator:c1', amount: -200, reason: 'manual', sourceRef: null, memo: '수기', deletable: true, createdAt: '2026-11-10T00:00:00.000Z' },
      ],
      adjustmentAmount: -300, netAmount: 100,
    })]);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
    expect(within(items[1]).getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });
});
