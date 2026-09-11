import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import FundingFailPage, { getServerSideProps } from '../../../pages/[locale]/funding/fail';

/**
 * 결제 실패 화면은 **우리 도메인·우리 레이아웃**이다. 예전에는 쿼리의 `message`를 그대로
 * 큰 글씨로 띄워서, 그 자리에 가짜 안내와 가짜 연락처를 넣은 링크를 누구나 만들 수 있었다
 * (실패 URL은 결제창이 만들지만 주소는 손으로도 칠 수 있다). 이제 `code`만 받아 표로 옮긴다.
 */
const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;
const run = async (query: Record<string, string>) =>
  (await getServerSideProps({ params: { locale: 'ko' }, query, res: resStub() } as never)) as { props: { slug: string | null; code: string | null; message: string; orderNo: string | null } };

it('쿼리의 message는 버린다 — 공격자가 고른 문장이 화면에 오르지 않는다', async () => {
  const { props } = await run({ message: '결제 실패. 환불 문의: 010-0000-0000 으로 연락하세요', code: 'PAY_PROCESS_CANCELED' });
  expect(props.message).toBe('결제를 취소하셨습니다.');
  expect(JSON.stringify(props)).not.toContain('010-0000-0000');
});

it('아는 코드는 우리 문구로 옮긴다', async () => {
  expect((await run({ code: 'REJECT_CARD_COMPANY' })).props.message).toContain('카드사에서 결제를 거절');
});

it('모르는 코드·코드 없음은 일반 문구', async () => {
  expect((await run({ code: 'SOMETHING_NEW' })).props.message).toBe('결제창이 닫혔거나 결제가 거절되었습니다.');
  expect((await run({})).props.message).toBe('결제창이 닫혔거나 결제가 거절되었습니다.');
});

it('코드 형식이 아니면 화면에 그대로 뿌리지 않는다', async () => {
  const { props } = await run({ code: '<img src=x onerror=alert(1)>' });
  expect(props.code).toBeNull();
});

it('정본 전화번호를 상시 표기한다', () => {
  render(<FundingFailPage slug="demo" code={null} message="결제창이 닫혔거나 결제가 거절되었습니다." orderNo={null} />);
  expect(screen.getByText(/010-4255-7893/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /프로젝트로 돌아가기/ })).toHaveAttribute('href', '/ko/funding/demo');
});

it('코드가 있으면 문의용으로 함께 보여준다', () => {
  render(<FundingFailPage slug={null} code="REJECT_CARD_COMPANY" message="카드사에서 결제를 거절했습니다." orderNo={null} />);
  expect(screen.getByText(/오류 코드: REJECT_CARD_COMPANY/)).toBeInTheDocument();
});

/**
 * 결제가 실패하면 고객이 문의를 하는데, 댈 식별자가 화면에 없었다. 토스가 실패 URL에
 * `orderId`로 실어 보내므로 주소창에는 이미 들어 있다 — 화면에 옮겨 적을 뿐이다.
 */
it('형태가 맞는 orderId는 문의용 주문번호로 보여준다', async () => {
  const { props } = await run({ orderId: 'FND-20260911-AB12CD34' });
  expect(props.orderNo).toBe('FND-20260911-AB12CD34');
});

it('형태를 벗어난 orderId는 버린다 — 임의 문자열이 화면에 렌더되지 않는다', async () => {
  for (const bad of ['<script>x</script>', '연락처는 010-0000-0000', 'FND-1', '']) {
    const { props } = await run({ orderId: bad });
    expect(props.orderNo).toBeNull();
  }
});
