/**
 * @jest-environment jsdom
 *
 * getServerSideProps 검증과 렌더 검증이 한 파일에 있다. getServerSideProps는 jsdom에서도
 * 그대로 돌지만 렌더 쪽은 document가 필요하므로 환경을 jsdom으로 둔다.
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import BookingFailPage, { getServerSideProps } from '../../../pages/[locale]/booking/fail';

/**
 * 결제 실패 화면의 "예약 페이지로 돌아가기"가 상품과 맞아야 한다.
 *
 * 예전엔 목적지가 /ko/booking/recording으로 하드코딩돼 있어, 축가 고객이 카드 한도로
 * 결제에 실패하면 녹음 예약 페이지로 갔다. failUrl에 service를 싣고 여기서 되돌린다.
 *
 * 쿼리값은 사용자가 조작할 수 있으므로 상품 정본(SESSION_PRODUCTS)에 있는 값만 쓴다.
 *
 * message·code도 마찬가지다 — 예전엔 쿼리의 message를 검증 없이 그대로 화면에 띄웠다.
 * pages/[locale]/funding/fail.tsx가 이미 푼 방식(code만 받아 표로 옮기고 message는 버림)을
 * 그대로 따른다.
 */

type Ctx = Parameters<typeof getServerSideProps>[0];
type Ok = { props: { service: string; code: string | null; message: string } };

const run = async (query: Record<string, string>): Promise<Ok> =>
  (await getServerSideProps({
    query,
    params: { locale: 'ko' },
    res: { setHeader: jest.fn() },
  } as unknown as Ctx)) as Ok;

describe('결제 실패 페이지 — 돌아갈 예약 페이지', () => {
  it.each(['recording', 'voice-acting', 'wedding-song', 'cover-video'])(
    '%s 예약은 같은 상품의 예약 페이지로 되돌린다',
    async (service) => {
      const r = await run({ service });
      expect(r.props.service).toBe(service);
    },
  );

  it('service가 없으면 녹음으로 되돌린다 (기존 동작)', async () => {
    expect((await run({})).props.service).toBe('recording');
  });

  it('모르는 값은 경로에 그대로 넣지 않는다', async () => {
    // 조작된 쿼리가 링크 목적지가 되면 안 된다.
    for (const bad of ['../../evil', 'https://evil.example', 'practice-room', '']) {
      expect((await run({ service: bad })).props.service).toBe('recording');
    }
  });

  it('아는 코드는 우리 문구로 옮긴다', async () => {
    const r = await run({ service: 'wedding-song', code: 'PAY_PROCESS_CANCELED' });
    expect(r.props.code).toBe('PAY_PROCESS_CANCELED');
    expect(r.props.message).toBe('결제를 취소하셨습니다.');
  });
});

describe('결제 실패 페이지 — 쿼리의 message는 버린다', () => {
  it('공격자가 고른 문장이 화면에 오르지 않는다', async () => {
    const r = await run({ message: '결제 실패. 환불 문의: 010-0000-0000 으로 연락하세요', code: 'PAY_PROCESS_CANCELED' });
    expect(r.props.message).toBe('결제를 취소하셨습니다.');
    expect(JSON.stringify(r.props)).not.toContain('010-0000-0000');
  });

  it('모르는 코드·코드 없음은 일반 문구로 떨어진다', async () => {
    expect((await run({ code: 'SOMETHING_NEW' })).props.message).toBe('결제 진행 중 문제가 발생했습니다.');
    expect((await run({})).props.message).toBe('결제 진행 중 문제가 발생했습니다.');
  });

  it('코드 형식이 아니면 화면에 그대로 뿌리지 않는다', async () => {
    const r = await run({ code: '<img src=x onerror=alert(1)>' });
    expect(r.props.code).toBeNull();
    expect(r.props.message).toBe('결제 진행 중 문제가 발생했습니다.');
  });
});

describe('결제 실패 페이지 — 렌더링', () => {
  it('message가 비거나 알 수 없어도 정본 연락처와 카카오 진입점이 있다', () => {
    render(<BookingFailPage service="recording" code={null} message="결제 진행 중 문제가 발생했습니다." />);
    expect(screen.getByText(/010-4255-7893/)).toBeInTheDocument();
    const kakaoLink = screen.getByRole('link', { name: /카카오톡으로 문의하기/ });
    expect(kakaoLink).toHaveAttribute('href', expect.stringContaining('kakao'));
    // 카카오 CTA 배색 규칙 — 목적지가 카카오톡인 링크는 옐로 고정.
    expect(kakaoLink.className).toContain('bg-kakao');
    expect(kakaoLink.className).toContain('text-kakao-ink');
  });

  it('돌아가기 링크가 상품에 맞는 예약/주문 페이지를 가리킨다', () => {
    render(<BookingFailPage service="mixing-mastering" code={null} message="결제 진행 중 문제가 발생했습니다." />);
    expect(screen.getByRole('link', { name: /주문 페이지로 돌아가기/ })).toHaveAttribute('href', '/ko/booking/mixing-mastering');
  });
});
