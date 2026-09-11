import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import FundingManagePage from '../../../../pages/[locale]/funding/manage/[orderNo]';

const baseProps = {
  orderNo: 'FND-1', token: 'tok', projectSlug: 'demo', projectTitle: '데모', rewardTitle: '감사 메일',
  quantity: 1, additionalAmount: 0, totalAmount: 30000, status: 'paid', fulfillmentStatus: 'none', shipping: null,
  canCancel: true, cancelBlockedReason: null, refundRequested: false, depositUrl: null,
  displayNamePublic: false, canEditDisplayName: true,
};

beforeEach(() => {
  window.confirm = jest.fn().mockReturnValue(true);
});

it('토스 결제 취소 성공 → 환불 금액 확인 문구', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, mode: 'refunded', refundAmount: 30000 }),
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="toss" />);
  await userEvent.click(screen.getByRole('button', { name: /후원 취소/ }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('환불받을까요'));
  expect(await screen.findByText('취소되었습니다. 30,000원이 환불됩니다.')).toBeInTheDocument();
});

it('무통장 취소 요청 → 계좌 회신 안내 문구, confirm 문구도 무통장 전용', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'application/json' },
    json: async () => ({ ok: true, mode: 'refund_requested' }),
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="bank_transfer" />);
  await userEvent.click(screen.getByRole('button', { name: /후원 취소/ }));
  expect(window.confirm).toHaveBeenCalledWith('취소를 요청할까요? 환불은 운영자가 계좌로 진행합니다.');
  expect(await screen.findByText('취소 요청을 접수했습니다. 환불 계좌를 메일로 회신해 주세요.')).toBeInTheDocument();
});

it('비JSON 응답이면 서버 오류 문구', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, headers: { get: () => 'text/html' },
    json: async () => { throw new Error('should not be called'); },
  }) as never;
  render(<FundingManagePage {...baseProps} paymentMethod="toss" />);
  await userEvent.click(screen.getByRole('button', { name: /후원 취소/ }));
  expect(await screen.findByText('서버 오류가 발생했습니다.')).toBeInTheDocument();
});

// 이 페이지의 URL에는 관리 토큰이 실린다. 이탈 링크가 클라 전환이면 공개 페이지에 나갔다
// 뒤로가기 할 때 gtag가 토큰 붙은 URL로 page_view를 보낸다 — 링크 종류(next/link 아님)는
// tests/pages/privateLinkNavigation.test.ts가 소스로 단언하고, 여기서는 href를 확인한다.
it('프로젝트·무통장 안내 링크는 href를 가진 앵커다', () => {
  render(<FundingManagePage {...baseProps} status="pending" paymentMethod="bank_transfer" depositUrl="/ko/funding/deposit/FND-1?token=tok" />);
  expect(screen.getByRole('link', { name: '데모' })).toHaveAttribute('href', '/ko/funding/demo');
  expect(screen.getByRole('link', { name: /무통장입금 안내/ })).toHaveAttribute('href', '/ko/funding/deposit/FND-1?token=tok');
});

// 부분환불 건은 상태 코드가 그대로 노출돼 고객이 'partially_refunded'를 읽고 있었다.
it('partially_refunded 상태는 한국어 라벨로 보인다', () => {
  render(<FundingManagePage {...baseProps} status="partially_refunded" canCancel={false} paymentMethod="toss" />);
  expect(screen.getByText('일부 환불')).toBeInTheDocument();
});

/**
 * 약관 제13조 2항 — "후원자 명단 이름 공개 동의는 후원 확인 페이지에서 철회할 수 있다".
 * 그런데 이 화면에는 공개 여부 표시조차 없었다(약관이 있다고 말한 기능이 코드에 없었다).
 */
describe('이름 공개 철회', () => {
  it('토글을 끄면 PATCH를 보내고 결과 문구를 띄운다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true, headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, displayNamePublic: false }),
    });
    global.fetch = fetchMock as never;
    render(<FundingManagePage {...baseProps} displayNamePublic paymentMethod="toss" />);
    const toggle = screen.getByLabelText('후원자 명단에 이름 공개');
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(await screen.findByText('후원자 명단에서 이름을 내렸습니다.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/funding/display-name');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ orderNo: 'FND-1', token: 'tok', displayNamePublic: false });
    expect(screen.getByLabelText('후원자 명단에 이름 공개')).not.toBeChecked();
  });

  it('실패하면 토글이 원래 값으로 되돌아간다 — 화면이 서버보다 앞서지 않는다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, headers: { get: () => 'application/json' },
      json: async () => ({ ok: false, message: '이 후원은 이름 공개 설정을 바꿀 수 없습니다.' }),
    }) as never;
    render(<FundingManagePage {...baseProps} displayNamePublic paymentMethod="toss" />);
    await userEvent.click(screen.getByLabelText('후원자 명단에 이름 공개'));
    expect(await screen.findByText('이 후원은 이름 공개 설정을 바꿀 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('후원자 명단에 이름 공개')).toBeChecked();
  });

  it('바꿀 수 없는 상태면 토글 대신 현재 값만 보인다', () => {
    render(<FundingManagePage {...baseProps} status="refunded" canCancel={false} canEditDisplayName={false} displayNamePublic paymentMethod="toss" />);
    expect(screen.queryByLabelText('후원자 명단에 이름 공개')).toBeNull();
    expect(screen.getByText('공개')).toBeInTheDocument();
  });
});

/**
 * 무통장 pending을 고객이 스스로 푸는 경로(항목 7). 같은 이메일+전화의 세 번째 무통장
 * 신청은 12시간 홀드에 막히는데, 예전에는 후원자가 그걸 풀 수단이 아예 없었다.
 */
describe('입금 전 무통장 신청 취소', () => {
  const pendingProps = { ...baseProps, status: 'pending', canCancel: false, paymentMethod: 'bank_transfer' as const, depositUrl: '/ko/funding/deposit/FND-1?token=tok' };

  it('신청 취소를 누르면 만료 전용 경로로 가고 상태가 바뀐다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true, headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, mode: 'pending_released' }),
    });
    global.fetch = fetchMock as never;
    render(<FundingManagePage {...pendingProps} />);
    await userEvent.click(screen.getByRole('button', { name: /신청 취소/ }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('입금 전 신청을 취소할까요'));
    expect(await screen.findByText(/신청을 취소했습니다/)).toBeInTheDocument();
    expect(screen.getByText('만료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /신청 취소/ })).toBeNull();
  });

  it('결제 확정 건에는 신청 취소 버튼이 없다 — 환불이 따라야 하는 취소는 별도 버튼이다', () => {
    render(<FundingManagePage {...baseProps} paymentMethod="bank_transfer" />);
    expect(screen.queryByRole('button', { name: /신청 취소/ })).toBeNull();
    expect(screen.getByRole('button', { name: /후원 취소/ })).toBeInTheDocument();
  });
});
