/* eslint-disable @next/next/no-html-link-for-pages --
 * 이 페이지의 HTML에는 관리 토큰이 실린 manage URL이 들어간다. 이탈 링크는 next/link가
 * 아니라 문서 이동이어야 한다 — 클라 전환으로 공개 페이지에 나갔다 뒤로가기 하면 그 사이
 * mount된 gtag가 살아 있는 채로 돌아와 이 화면의 상태를 다시 측정한다.
 * 근거·경로 목록: lib/analytics/privatePaths.ts, 회귀 테스트:
 * tests/pages/privateLinkNavigation.test.ts
 */
import { useEffect } from 'react';
import { withI18nServerProps } from '../../../lib/getStatic';
import Head from 'next/head';

import { isTokenMatch } from '../../../lib/booking/token';
import { confirmFundingPledge } from '../../../lib/funding/confirm';
import { FUNDING_ORDER_STATUS_LABELS } from '../../../lib/funding/fulfillmentLabels';
import { isLiveFundingOrderStatus } from '../../../lib/funding/refundable';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { getFundingProjectAsync } from '../../../lib/funding/repository';
import { clearDraftsByPrefix, clearStoredDraft, draftStorageKey } from '../../../lib/formDraft';
import { trackMicroEvent } from '../../../utils/analytics';

interface SuccessProps {
  /**
   * confirmed = 이 브라우저가 방금 확정한 후원, unknown = 확정 화면을 되살릴 근거가 없음,
   * not_live = 소유는 증명됐지만 그 후원이 더 이상 살아 있지 않음(취소·환불·만료).
   */
  outcome: 'confirmed' | 'unknown' | 'error' | 'not_live';
  message?: string;
  /** not_live일 때 지금 상태를 후원자 표기로 옮긴 것. manage 화면과 같은 정본을 쓴다. */
  statusLabel?: string;
  orderNo?: string;
  /** 후원 확인·취소 링크. 메일이 실패해도 고객이 여기서 바로 받을 수 있어야 한다. */
  manageUrl?: string;
  /** 내려받기 폼이 서버에 자기 자격을 증명할 값. 이미 manageUrl에 실려 있는 그 토큰이다. */
  manageToken?: string;
  projectSlug?: string;
  /** 확인 메일이 실제로 나갔는지(orders.notificationError 기준). */
  emailSent?: boolean;
  /**
   * 후원한 리워드의 내려받기 링크. **이 화면에 직접 둔다** — 예전엔 확정 화면에서 후원
   * 확인 페이지로 한 번 더 들어가야 음원을 받을 수 있었다. 결제를 막 마친 사람에게
   * 필요한 것은 "확정되었습니다"가 아니라 파일이다.
   *
   * 나가는 값은 저장소 주소가 아니라 파일 키다 — 실제 주소는 버튼을 눌렀을 때 서버가
   * 서명해 만든다(pages/api/funding/download.ts). 그래야 최초 접근을 기록해 약관 제8조
   * 2항(내려받기 뒤 청약철회 제한)을 판정할 수 있다.
   */
  downloads?: Array<{ label: string; key: string }>;
}

/**
 * 확정 직후 세우는 단기 쿠키. `<orderNo>.<manageToken>` 한 쌍이다.
 *
 * 왜 필요한가: 토스가 돌려보내는 success URL에는 paymentKey·orderId·amount가 실려 있어
 * 측정에서 통째로 빠져 있었고(lib/analytics/privatePaths.ts), 그 결과 펀딩 퍼널이
 * **진입 100% · 결제 0%** 로 보였다. 이제 확정이 끝나면 비밀값이 없는 `?o=<주문번호>`로
 * 리다이렉트하고 그 화면에서 전환을 측정한다. 관리 토큰은 URL로 옮길 수 없으므로
 * (URL은 측정 대상이 된다) httpOnly 쿠키로 넘긴다 — 자바스크립트도, 측정 스크립트도
 * 읽지 못하고 이 경로로만 전송된다.
 *
 * 주문번호는 비밀이 아니다(확정·입금 안내 메일, 화면, 영수증에 평문). 그래서 `?o=`만으로는
 * 아무 것도 열리지 않는다 — 쿠키의 토큰이 DB의 manageToken과 맞아야 확정 화면이 나온다.
 */
const CONFIRM_COOKIE = 'fnd_confirm';
const CONFIRM_COOKIE_PATH = '/ko/funding/success';
const CONFIRM_COOKIE_MAX_AGE = 30 * 60;
const ORDER_NO_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

const buildConfirmCookie = (orderNo: string, token: string): string =>
  [
    `${CONFIRM_COOKIE}=${encodeURIComponent(`${orderNo}.${token}`)}`,
    `Path=${CONFIRM_COOKIE_PATH}`,
    `Max-Age=${CONFIRM_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');

/**
 * Next는 `req.cookies`를 이미 디코드해 준다 — 여기서 다시 디코드하면 `%`가 든 손상된 쿠키
 * 하나로 getServerSideProps가 URIError 500을 낸다(결제를 마친 사람이 보는 화면이다).
 * 값은 base64url 토큰과 주문번호뿐이라 추가 디코드가 필요하지도 않다.
 */
const parseConfirmCookie = (raw: string | undefined): { orderNo: string; token: string } | null => {
  if (!raw) return null;
  const value = raw;
  const sep = value.indexOf('.');
  if (sep <= 0 || sep === value.length - 1) return null;
  return { orderNo: value.slice(0, sep), token: value.slice(sep + 1) };
};

const PHONE = '010-4255-7893';
const EMAIL = 'hello@studionol.co.kr';

/**
 * 확정 실패 코드 → 우리가 쓴 문구.
 *
 * 실패도 **비밀값 없는 URL로 리다이렉트**해야 한다. 예전(이 파일의 첫 수정본)에는 실패만
 * 승인 URL 그 자리에서 렌더했는데, 이 경로는 측정 대상이라 `?paymentKey=…&orderId=…`가
 * 그대로 GA4의 page_location에 적재된다 — 결제창을 오래 열어 뒀다 승인(hold_expired)하거나
 * 카드사가 거절(toss_rejected)하면 실제 paymentKey가 남는다. 그래서 코드만 `?e=`로 넘기고
 * 문구는 여기서 고른다(fail.tsx와 같은 방식). 모르는 코드는 일반 문구로 떨어진다.
 *
 * 키는 `FundingConfirmOutcome`의 실패 코드다(lib/funding/confirm.ts).
 */
const CONFIRM_ERROR_MESSAGES: Record<string, string> = {
  not_found: '펀딩 내역을 찾을 수 없습니다. 주문번호를 확인해 주세요.',
  amount_mismatch: '결제 금액이 펀딩 내용과 일치하지 않습니다.',
  invalid_state: '이미 처리되었거나 만료된 펀딩입니다.',
  hold_expired: '결제 대기 시간이 만료된 펀딩입니다. 다시 펀딩해 주세요.',
  toss_rejected: '결제 승인이 거절되었습니다. 다시 시도하시거나 다른 결제수단을 이용해 주세요.',
  recording_failed: '결제는 완료되었으나 펀딩 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정됩니다.',
};
const GENERIC_ERROR = '결제를 확정하지 못했습니다.';
const ERROR_CODE_PATTERN = /^[a-z_]{1,40}$/;

export default function FundingSuccessPage({ outcome, message, statusLabel, orderNo, manageUrl, manageToken, projectSlug, emailSent, downloads }: SuccessProps) {
  useEffect(() => {
    if (outcome !== 'confirmed' || !orderNo) return;
    // 결제가 확정됐으니 후원 폼에 남아 있던 이름·연락처·주소 임시 저장을 지운다
    // (lib/formDraft.ts). projectSlug를 알면 그 프로젝트 것만, 모르면(주문에
    // fundingPledge 연결이 비는 예외적인 경우) 펀딩 흐름 전체를 지운다 — 결제가 끝난
    // 세션에 배송지를 남겨 둘 이유가 없다.
    if (projectSlug) clearStoredDraft(draftStorageKey('funding', projectSlug));
    else clearDraftsByPrefix('studionol:funding-draft:');
    // 새로고침마다 다시 세지 않는다 — 이 화면은 쿠키가 살아 있는 30분 동안 몇 번이고
    // 열릴 수 있고, 그때마다 발화하면 결제 수가 부풀려진다.
    try {
      const key = `funding_pledge_paid:${orderNo}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // 프라이빗 모드·저장소 차단 — 중복 억제만 못 할 뿐 측정은 계속한다.
    }
    // 펀딩 확정 마이크로 전환 — GA4 key event로 지정 금지(utils/analytics.ts 참조,
    // 유일하게 신뢰 가능한 지표인 카톡 리드를 희석하지 않기 위함).
    trackMicroEvent('funding_pledge_paid', { component: 'funding_success', landing_slug: projectSlug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, orderNo]);

  return (
    <>
      <Head>
        <title>펀딩 결제 완료 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:pt-20">
        <div className="glass-card rounded-2xl p-6 text-center sm:p-8">
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다. */}
        <p className="typo-card-meta mb-2">스튜디오 놀</p>
        {outcome === 'confirmed' ? (
          <>
            <h1 className="typo-page-title">펀딩이 확정되었습니다</h1>
            <p className="typo-card-body mx-auto mt-3 max-w-md">
              주문번호 {orderNo}.
              {emailSent === false
                ? ' 확인 메일을 보내지 못했습니다 — 아래 링크를 저장해 주세요.'
                : ' 펀딩 확인 메일을 보내드렸습니다.'}
            </p>
            {downloads && downloads.length > 0 && (
              <div className="mt-6 space-y-2 text-left">
                <p className="typo-card-meta text-center">지금 바로 받으실 수 있습니다.</p>
                {/* 링크가 아니라 폼이다 — 주소를 여는 것만으로는 기록이 남지 않아야 한다. */}
                {downloads.map((d) => (
                  <form key={d.key} method="post" action="/api/funding/download">
                    <input type="hidden" name="orderNo" value={orderNo} />
                    <input type="hidden" name="token" value={manageToken} />
                    <input type="hidden" name="file" value={d.key} />
                    <button
                      type="submit"
                      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
                    >
                      {d.label} 내려받기
                    </button>
                  </form>
                ))}
                <p className="typo-card-meta text-center">
                  내려받기를 시작하면 청약철회가 제한됩니다(약관 제8조 2항).
                </p>
              </div>
            )}
            {/* 관리 링크를 화면에도 띄운다. 예전엔 이 토큰이 메일에만 실려서, 메일이
                실패하면 고객이 펀딩을 스스로 취소할 방법이 아예 없었다. */}
            {manageUrl && (
              <p className="mt-6">
                <a
                  href={manageUrl}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
                >
                  펀딩 확인·취소 페이지 열기
                </a>
              </p>
            )}
            {manageUrl && (
              <p className="typo-card-meta mx-auto mt-3 max-w-md break-all">
                이 주소를 저장해 두세요: {manageUrl}
              </p>
            )}
            {projectSlug && (
              <p className="typo-card-meta mt-6">
                {/* 공개 목적지에는 rel="noreferrer" — 이 URL에 비밀값은 없지만(주문번호뿐),
                    도착지 gtag의 page_referrer에 주문번호까지 실어 보낼 이유는 없다. */}
                <a href={`/ko/funding/${projectSlug}`} rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">
                  프로젝트로 돌아가기
                </a>
              </p>
            )}
          </>
        ) : outcome === 'not_live' ? (
          <>
            {/* 확정 쿠키는 30분 살아 있다. 그 사이 취소하고 이 화면을 새로고침하면 예전에는
                "펀딩이 확정되었습니다"와 내려받기 버튼이 그대로 다시 떴다 — 돈은 돌려받고
                파일은 계속 받는 것처럼 보이는 화면이다(버튼을 눌러도 download.ts가 409로
                막지만, 그건 원시 JSON이다). 판정은 manage 화면과 같은
                isLiveFundingOrderStatus를 쓴다. */}
            <h1 className="typo-page-title">이 펀딩은 확정 상태가 아닙니다</h1>
            <p className="typo-card-body mx-auto mt-3 max-w-md">
              {orderNo ? `주문번호 ${orderNo}. ` : ''}현재 상태는 “{statusLabel}”입니다.
            </p>
            <p className="typo-card-meta mx-auto mt-3 max-w-md">
              자세한 내역은 펀딩 확인 페이지에서 보실 수 있습니다. 문의: {PHONE} · {EMAIL}
            </p>
            {manageUrl && (
              <p className="mt-6">
                <a
                  href={manageUrl}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
                >
                  펀딩 확인 페이지 열기
                </a>
              </p>
            )}
            {projectSlug && (
              <p className="typo-card-meta mt-6">
                <a href={`/ko/funding/${projectSlug}`} rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">
                  프로젝트로 돌아가기
                </a>
              </p>
            )}
          </>
        ) : outcome === 'unknown' ? (
          <>
            <h1 className="typo-page-title">펀딩 내역을 확인해 주세요</h1>
            {/* 쿠키가 없으면(브라우저 차단·30분 경과·다른 기기) 관리 링크를 만들 근거가 없다.
                그래도 결제한 사람이 빈손으로 나가면 안 된다 — 주문번호와 문의처, 그리고
                "관리 링크는 메일에 있다"까지는 반드시 남긴다. 토큰을 URL에 실어 폴백을
                만드는 방법은 쓰지 않는다: 그 순간 이 경로가 다시 비밀값을 달게 되고,
                주문번호만 알면 열리는 화면이 되어 confirm이 막아 둔 구멍이 되살아난다. */}
            <p className="typo-card-body mx-auto mt-3 max-w-md">
              {orderNo ? `주문번호 ${orderNo}. ` : ''}이 화면에서는 펀딩 상세를 다시 열 수 없습니다.
              결제가 끝났다면 펀딩 확인 메일에 펀딩 확인·취소 링크가 들어 있습니다.
            </p>
            <p className="typo-card-meta mx-auto mt-3 max-w-md">
              메일이 보이지 않거나 취소를 원하시면 주문번호와 함께 연락해 주세요: {PHONE} · {EMAIL}
            </p>
            <a
              href="/ko/funding"
              rel="noreferrer"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
            >
              펀딩 목록으로 돌아가기
            </a>
          </>
        ) : (
          <>
            <h1 className="typo-page-title">결제를 확정하지 못했습니다</h1>
            <p className="typo-card-body mx-auto mt-3 max-w-md">{message}</p>
            <p className="typo-card-meta mx-auto mt-3 max-w-md">결제가 이뤄졌다면 자동으로 취소되거나 확정됩니다. 문의: {PHONE} · {EMAIL}</p>
            {/* 오류 분기에도 눌러야 할 곳이 하나는 있어야 한다 — fail.tsx와 같은 solid 버튼. */}
            <a
              href="/ko/funding"
              rel="noreferrer"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
            >
              펀딩 목록으로 돌아가기
            </a>
          </>
        )}
        </div>
        {outcome === 'confirmed' && (
          <p className="typo-card-meta mt-6 text-center">
            <a href="/ko/funding" rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">펀딩 목록으로</a>
          </p>
        )}
      </main>
    </>
  );
}

/**
 * 두 가지 요청을 받는다.
 *
 * 1. **토스가 돌려보낸 승인 URL**(`paymentKey`·`orderId`·`amount`) — 확정하고, 쿠키를 세우고,
 *    비밀값 없는 `?o=<주문번호>`로 리다이렉트한다. 화면은 그리지 않는다.
 * 2. **리다이렉트된 화면**(`?o=`) — 쿠키의 토큰이 주문의 manageToken과 맞을 때만 확정 화면을
 *    그린다. 새로고침해도 confirm을 다시 부르지 않으므로(승인 URL이 아니다) 멱등하다.
 *    뒤로가기로 1의 URL에 돌아가면 confirm이 다시 돌지만, `confirmFundingPledge`가 paid
 *    주문에 **올바른 paymentKey**를 요구하므로 진짜 고객만 통과해 같은 자리로 되돌아온다.
 */
export const getServerSideProps = withI18nServerProps<SuccessProps>(async ({ query, req, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };

  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey === 'string' && typeof orderId === 'string' && typeof amount === 'string') {
    const result = await confirmFundingPledge({ orderNo: orderId, paymentKey, amount: Number(amount) });
    // 성공이든 실패든 이 URL에서는 화면을 그리지 않는다 — paymentKey·orderId가 붙은 채로
    // 렌더되는 순간 측정에 적재된다(CONFIRM_ERROR_MESSAGES 주석).
    if (!result.ok) return { redirect: { destination: `/ko/funding/success?e=${encodeURIComponent(result.code)}`, permanent: false } };
    res.setHeader('Set-Cookie', buildConfirmCookie(result.orderNo, result.manageToken));
    return { redirect: { destination: `/ko/funding/success?o=${encodeURIComponent(result.orderNo)}`, permanent: false } };
  }

  if (typeof query.e === 'string') {
    const code = ERROR_CODE_PATTERN.test(query.e) ? query.e : '';
    return { props: { outcome: 'error', message: CONFIRM_ERROR_MESSAGES[code] ?? GENERIC_ERROR } };
  }

  const requested = typeof query.o === 'string' && ORDER_NO_PATTERN.test(query.o) ? query.o.toUpperCase() : null;
  if (!requested) return { props: { outcome: 'error', message: '잘못된 접근입니다.' } };

  const cookie = parseConfirmCookie(req.cookies?.[CONFIRM_COOKIE]);
  // 쿠키가 없거나 다른 주문의 것이면 DB를 아예 조회하지 않는다 — 주문번호만 아는 제3자가
  // 주문의 존재 여부를 떠볼 수 있는 경로를 만들지 않는다.
  // 주문번호는 비밀이 아니므로(메일·화면·영수증에 평문) unknown 화면에 그대로 되돌려준다 —
  // 문의할 때 이 번호가 없으면 고객이 스스로 할 수 있는 일이 없다.
  const unknown = { props: { outcome: 'unknown' as const, orderNo: requested } };
  if (!cookie || cookie.orderNo.toUpperCase() !== requested) return unknown;
  const order = await findFundingOrderByOrderNo(requested);
  if (!order || !isTokenMatch(order.manageToken, cookie.token)) return unknown;
  /**
   * 후원한 리워드의 내려받기 링크를 이 화면에서 바로 만든다. 여기까지 온 요청은 쿠키의
   * 토큰이 DB의 manageToken과 맞는 것이 이미 확인됐으므로(위 분기), 링크를 세울 근거가 있다.
   */
  /**
   * 살아 있지 않은 후원(취소·환불·만료·실패)에는 확정 문구도 내려받기 폼도 그리지 않는다.
   * 확정 쿠키가 30분 살아 있어 취소 직후 새로고침이 이 자리로 돌아온다. 판정은 manage
   * 화면과 같은 함수를 쓴다 — 두 화면이 갈리면 한쪽만 고쳐 놓고 끝났다고 믿게 된다.
   */
  if (!isLiveFundingOrderStatus(order.status)) {
    return {
      props: {
        outcome: 'not_live',
        orderNo: order.orderNo,
        statusLabel: FUNDING_ORDER_STATUS_LABELS[order.status] ?? order.status,
        manageUrl: `/ko/funding/manage/${order.orderNo}?token=${order.manageToken}`,
        projectSlug: order.fundingPledge?.projectSlug ?? '',
      },
    };
  }
  const project = order.fundingPledge ? await getFundingProjectAsync(order.fundingPledge.projectSlug) : null;
  const reward = project?.rewards.find((r) => r.id === order.fundingPledge?.rewardId);
  const downloads = (reward?.downloads ?? []).map((d) => ({ label: d.label, key: d.key }));

  return {
    props: {
      outcome: 'confirmed',
      orderNo: order.orderNo,
      downloads,
      manageUrl: `/ko/funding/manage/${order.orderNo}?token=${order.manageToken}`,
      manageToken: order.manageToken,
      projectSlug: order.fundingPledge?.projectSlug ?? '',
      // notificationError는 확정 메일 결과다 — null이면 발송 성공, 문자열이면 실패이거나
      // 아직 발송 전(confirm.ts의 send_pending 센티널)이다. 둘 다 "링크를 저장하세요"가 맞다.
      emailSent: order.notificationError === null,
    },
  };
});
