import type { GetServerSideProps } from 'next';
import Head from 'next/head';

/**
 * 토스 실패 코드 → 우리가 쓴 문구.
 *
 * 예전엔 쿼리의 `message`를 그대로 큰 글씨로 출력했다. 실패 URL은 결제창이 만들지만 그
 * 주소는 누구나 손으로 칠 수 있으므로, 우리 도메인·우리 레이아웃 안에 **공격자가 고른
 * 문장**(가짜 연락처·가짜 안내)을 띄울 수 있었다. 이제 `code`만 받아 이 표로 옮기고
 * `message`는 버린다 — 모르는 코드는 일반 문구로 떨어진다.
 *
 * 코드 출처: 토스페이먼츠 결제창 실패 코드. 목록에 없다고 화면이 깨지지 않으므로
 * 자주 보는 것만 적어 둔다.
 */
const FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제를 취소하셨습니다.',
  PAY_PROCESS_ABORTED: '결제가 완료되기 전에 창이 닫혔습니다.',
  USER_CANCEL: '결제를 취소하셨습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다. 다른 카드나 결제수단으로 시도해 주세요.',
  INVALID_CARD_EXPIRATION: '카드 유효기간을 다시 확인해 주세요.',
  INVALID_STOPPED_CARD: '정지된 카드입니다. 다른 결제수단으로 시도해 주세요.',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: '하루 결제 가능 횟수를 초과했습니다. 내일 다시 시도하거나 다른 결제수단을 이용해 주세요.',
  EXCEED_MAX_PAYMENT_AMOUNT: '결제 한도를 초과했습니다. 카드사에 문의하거나 다른 결제수단을 이용해 주세요.',
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: '이 카드로는 선택하신 할부 개월 수를 쓸 수 없습니다.',
  INVALID_CARD_NUMBER: '카드번호를 다시 확인해 주세요.',
  NOT_AVAILABLE_BANK: '은행 서비스 시간이 아닙니다. 잠시 후 다시 시도해 주세요.',
};
const GENERIC_MESSAGE = '결제창이 닫혔거나 결제가 거절되었습니다.';
/** 화면에 그대로 보여도 되는 코드 형태. 표에 없는 코드도 문의할 때 쓸 수 있게 보여준다. */
const CODE_PATTERN = /^[A-Z0-9_]{1,60}$/;

interface Props { slug: string | null; code: string | null; message: string }

export default function FundingFailPage({ slug, code, message }: Props) {
  return (
    <>
      <Head><title>결제 실패 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:pt-20">
        <div className="glass-card rounded-2xl p-6 text-center sm:p-8">
          {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
              여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
              화면인지 알 수 있어야 한다. */}
          <p className="typo-card-meta mb-2">스튜디오 놀</p>
          <h1 className="typo-page-title">결제가 완료되지 않았습니다</h1>
          <p className="typo-card-body mx-auto mt-3 max-w-md">{message}</p>
          <p className="typo-card-meta mx-auto mt-3 max-w-md">
            결제가 이뤄지지 않았으므로 청구되지 않습니다. 15분 뒤 신청이 자동 해제되며 다시 후원할 수 있습니다.
          </p>
          {/* 정본 연락처를 상시 표기한다 — 예전에는 쿼리의 message가 주 안내문이라, 그 자리에
              가짜 연락처를 넣으면 화면에 우리 번호가 하나도 없었다. */}
          <p className="typo-card-meta mx-auto mt-3 max-w-md">
            문의: 010-4255-7893 · hello@studionol.co.kr
          </p>
          {code && <p className="typo-card-meta mx-auto mt-3 max-w-md">오류 코드: {code}</p>}
          {/* 이 URL에는 토스가 붙인 orderId(주문번호)가 실린다. 이탈 링크 두 가지 규칙(lib/analytics/privatePaths.ts):
              1. 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를 누르면,
                 그 사이 mount된 gtag가 비밀값이 붙은 이 URL로 page_view를 보낸다.
              2. 공개 목적지에는 `rel="noreferrer"` — 사이트 Referrer-Policy가
                 strict-origin-when-cross-origin이라 **동일 출처 이동에는 전체 URL**을 보낸다.
                 없으면 도착지 gtag가 page_referrer에 토큰·paymentKey를 실어 보낸다.
                 private→private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 불필요. */}
          <a
            href={slug ? `/ko/funding/${slug}` : '/ko/funding'}
            rel="noreferrer"
            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
          >
            프로젝트로 돌아가기
          </a>
        </div>
      </main>
    </>
  );
}
export const getServerSideProps: GetServerSideProps<Props> = async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const slug = typeof query.slug === 'string' && /^[a-z0-9-]+$/.test(query.slug) ? query.slug : null;
  // code만 받는다. query.message는 읽지도 않는다 — 표에 없는 코드는 일반 문구로 떨어진다.
  const code = typeof query.code === 'string' && CODE_PATTERN.test(query.code) ? query.code : null;
  return { props: { slug, code, message: (code && FAIL_MESSAGES[code]) || GENERIC_MESSAGE } };
};
