import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SubscribeFailPage, { getServerSideProps } from '../../../pages/[locale]/subscribe/[id]/fail';

/**
 * 카드 등록 실패 화면은 **우리 도메인·우리 레이아웃**이다. getServerSideProps가 구독 존재
 * 여부도 토큰 일치도 보지 않으므로 이 주소는 누구나 손으로 칠 수 있고, 예전에는 쿼리의
 * `message`를 그대로 주 안내문으로 띄워 가짜 안내·가짜 연락처를 심을 수 있었다.
 * 이제 funding/fail·booking/fail과 같이 `code`만 표로 옮긴다.
 */
const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;
const run = async (query: Record<string, string>) =>
  (await getServerSideProps({
    params: { locale: 'ko', id: 'sub-1' },
    query,
    res: resStub(),
  } as never)) as { props: { id: string; setupToken: string; code: string | null; message: string } };

it('쿼리의 message는 버린다 — 공격자가 고른 문장이 화면에 오르지 않는다', async () => {
  const { props } = await run({
    token: 'tok',
    code: 'PAY_PROCESS_CANCELED',
    message: '등록 실패. 재등록 문의: 010-0000-0000 으로 연락하세요',
  });
  expect(props.message).toBe('카드 등록을 취소하셨습니다.');
  expect(JSON.stringify(props)).not.toContain('010-0000-0000');
});

it('아는 코드는 우리 문구로 옮긴다', async () => {
  expect((await run({ token: 'tok', code: 'REJECT_CARD_COMPANY' })).props.message).toContain('카드사에서 등록을 거절');
});

it('모르는 코드·코드 없음은 일반 문구', async () => {
  expect((await run({ token: 'tok', code: 'SOMETHING_NEW' })).props.message).toBe('카드 인증 중 문제가 발생했습니다.');
  expect((await run({ token: 'tok' })).props.message).toBe('카드 인증 중 문제가 발생했습니다.');
});

it('코드 형식이 아니면 화면에 그대로 뿌리지 않는다', async () => {
  const { props } = await run({ token: 'tok', code: '<img src=x onerror=alert(1)>' });
  expect(props.code).toBeNull();
});

it('토큰이 없으면 notFound', async () => {
  const result = await getServerSideProps({
    params: { locale: 'ko', id: 'sub-1' },
    query: {},
    res: resStub(),
  } as never);
  expect(result).toEqual({ notFound: true });
});

it('정본 전화번호를 상시 표기하고, 재시도 링크는 문서 이동이다', () => {
  render(<SubscribeFailPage id="sub-1" setupToken="tok en" code={null} message="카드 인증 중 문제가 발생했습니다." />);
  expect(screen.getByText(/010-4255-7893/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /다시 시도하기/ })).toHaveAttribute(
    'href',
    '/ko/subscribe/sub-1?token=tok%20en',
  );
});

it('코드가 있으면 문의용으로 함께 보여준다', () => {
  render(<SubscribeFailPage id="sub-1" setupToken="tok" code="REJECT_CARD_COMPANY" message="카드사에서 등록을 거절했습니다." />);
  expect(screen.getByText(/오류 코드: REJECT_CARD_COMPANY/)).toBeInTheDocument();
});
