/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SubscribeSetupPage from '../../../pages/[locale]/subscribe/[id]';

/**
 * 동의를 **버튼을 누르는 행위**로 받는다는 계약.
 *
 * 예약·믹싱·펀딩 결제 화면과 같은 방식이다(#162). 구독만 체크박스를 남겨 두면 같은 상품의
 * 결제 화면끼리 방식이 갈린다 — 매달 빠져나가는 결제라 동의의 무게가 크다는 점은 체크 한
 * 번이 아니라 **화면에 무엇이 적혀 있는가**로 받쳐야 한다. 그래서 해지·환불 규정 전문과
 * 매월 자동 청구 사실을 버튼 위에 그대로 펼쳐 두고, 그 아래 고지 한 줄을 둔다.
 *
 * 카드 등록창을 여는 버튼은 토스 SDK를 물고 있어 여기서는 모의로 바꾼다 — 이 테스트가 보는
 * 것은 동의를 받는 방식이지 결제 연동이 아니다.
 */
jest.mock('../../../components/billing/BillingAuthButton', () => ({
  __esModule: true,
  default: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>카드 등록하기</button>
  ),
}));

const OK_PROPS = {
  outcome: 'ok' as const,
  id: 'sub-1',
  setupToken: 'tok',
  customerKey: 'ck',
  customerName: '홍길동',
  customerEmail: 'hong@example.com',
  productName: '음악연습실 월 이용료',
  itemAmount: 360000,
  vatAmount: 36000,
  totalAmount: 396000,
  billingDay: 10,
  setupMode: 'initial' as const,
  kind: 'practice-room',
};

describe('구독 카드 등록 화면의 동의', () => {
  it('동의 체크박스를 두지 않는다', () => {
    render(<SubscribeSetupPage {...OK_PROPS} />);

    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('버튼을 누르면 동의하는 것으로 본다고 고지한다', () => {
    render(<SubscribeSetupPage {...OK_PROPS} />);

    expect(
      screen.getByText('카드 등록하기를 누르면 위 결제 조건과 해지·환불 규정에 동의하는 것으로 봅니다.'),
    ).toBeInTheDocument();
  });

  /** 고지만 남기고 규정을 빼면 "무엇에 동의하는지"가 화면에서 사라진다. */
  it('해지·환불 규정 전문이 고지보다 위에 펼쳐져 있다', () => {
    render(<SubscribeSetupPage {...OK_PROPS} />);
    const policyHeading = screen.getByText('해지·환불 규정');
    const notice = screen.getByText(/동의하는 것으로 봅니다/);

    expect(policyHeading.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /** 체크박스가 없어졌으니 그것 때문에 버튼이 잠겨 있으면 아무도 등록할 수 없다. */
  it('등록 버튼이 동의 체크 때문에 잠겨 있지 않다', () => {
    render(<SubscribeSetupPage {...OK_PROPS} />);

    expect(screen.getByRole('button', { name: '카드 등록하기' })).not.toBeDisabled();
  });
});
