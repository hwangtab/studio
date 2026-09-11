import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { Button } from '../../../../components/ui/Button';
import { formatPriceAmount } from '../../../../data/pricing';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from '../../../../lib/funding/policy';
import { computeProjectState, getFundingProject } from '../../../../lib/funding/projects';
import { expireStalePledges, findFundingOrderByOrderNo } from '../../../../lib/funding/service';

interface Props {
  orderNo: string; token: string; projectSlug: string; projectTitle: string; rewardTitle: string; quantity: number; additionalAmount: number;
  totalAmount: number; status: string; paymentMethod: string; fulfillmentStatus: string; shipping: string | null;
  canCancel: boolean; cancelBlockedReason: string | null; refundRequested: boolean;
  /** 후원자 명단 이름 공개 동의 여부와, 지금 그것을 바꿀 수 있는지. */
  displayNamePublic: boolean; canEditDisplayName: boolean;
}
const STATUS_LABEL: Record<string, string> = { pending: '결제 대기', paid: '후원 확정', partially_refunded: '일부 환불', refunded: '환불 완료', expired: '만료', failed: '결제 실패' };
const FULFILL_LABEL: Record<string, string> = { none: '준비 전', preparing: '발송 준비 중', shipped: '발송 완료', delivered: '전달 완료' };

export default function FundingManagePage(p: Props) {
  const [status, setStatus] = useState(p.status);
  const [refundRequested, setRefundRequested] = useState(p.refundRequested);
  const [displayNamePublic, setDisplayNamePublic] = useState(p.displayNamePublic);
  const [busy, setBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  /**
   * 약관 제13조 2항 — "후원 확인 페이지에서 이름 공개 동의를 철회할 수 있다". 낙관적으로
   * 먼저 바꾸고 실패하면 되돌린다(토글은 즉각 반응해야 한다).
   */
  const updateDisplayName = async (next: boolean) => {
    const previous = displayNamePublic;
    setDisplayNamePublic(next);
    setNameBusy(true); setError(null); setConfirmMessage(null);
    try {
      const res = await fetch('/api/funding/display-name', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: p.orderNo, token: p.token, displayNamePublic: next }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        setDisplayNamePublic(previous); setError('서버 오류가 발생했습니다.'); return;
      }
      const json = await res.json();
      if (!res.ok) { setDisplayNamePublic(previous); setError(json.message ?? '이름 공개 설정을 바꾸지 못했습니다.'); return; }
      setDisplayNamePublic(Boolean(json.displayNamePublic));
      // 프로젝트 페이지의 공개 명단은 상태 API 응답(s-maxage=60 · SWR 300)을 통해 나가므로
      // 여기서 즉답해도 화면에는 최대 몇 분 뒤 반영된다 — 그걸 말하지 않으면
      // "철회가 안 됐다"는 문의가 온다.
      setConfirmMessage(json.displayNamePublic
        ? '후원자 명단에 이름을 공개합니다. 프로젝트 페이지에는 최대 몇 분 뒤 반영됩니다.'
        : '후원자 명단에서 이름을 내렸습니다. 프로젝트 페이지에는 최대 몇 분 뒤 반영됩니다.');
    } catch {
      setDisplayNamePublic(previous); setError('네트워크 오류가 발생했습니다.');
    } finally { setNameBusy(false); }
  };

  const cancel = async () => {
    const confirmText = `후원을 취소하고 ${formatPriceAmount(p.totalAmount)}원을 환불받을까요?`;
    if (!window.confirm(confirmText)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/funding/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo: p.orderNo, token: p.token }) });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        setError('서버 오류가 발생했습니다.');
        return;
      }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '취소에 실패했습니다.'); return; }
      // `pending_released`(입금 전 무통장 신청의 셀프 해제) 분기는 그 엔드포인트와 함께
      // 없어졌다. `refund_requested`도 지금은 만들어지지 않지만, 서버가 옛 행에 그 모드를
      // 돌려줄 여지가 남아 있어 표시만 남긴다.
      if (json.mode === 'refund_requested') {
        setRefundRequested(true);
        setConfirmMessage('취소 요청을 접수했습니다. 환불 계좌를 메일로 회신해 주세요.');
      } else {
        setStatus('refunded');
        setConfirmMessage(`취소되었습니다. ${formatPriceAmount(json.refundAmount ?? p.totalAmount)}원이 환불됩니다.`);
      }
    } catch { setError('네트워크 오류가 발생했습니다.'); } finally { setBusy(false); }
  };
  return (
    <>
      <Head><title>후원 확인 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-16 sm:pt-20">
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다. */}
        <p className="typo-card-meta">스튜디오 놀</p>
        <h1 className="typo-section-title mt-1">후원 확인</h1>
        <p className="typo-section-lead mt-3">후원 내역과 진행 상태를 확인하고, 조건이 되면 여기서 취소할 수 있습니다.</p>

        <div className="glass-card mt-8 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              status === 'paid'
                ? 'bg-primary/10 text-primary dark:bg-primary-light/15 dark:text-violet-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {STATUS_LABEL[status] ?? status}
            </span>
            {refundRequested && status === 'paid' && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">환불 요청 접수</span>
            )}
          </div>

          {/* 이 URL에는 관리 토큰이 실린다. 이탈 링크 두 가지 규칙(lib/analytics/privatePaths.ts):
              1. 문서 이동(`<a href>`) — next/link 클라 전환으로 나갔다가 뒤로가기를 누르면,
                 그 사이 mount된 gtag가 비밀값이 붙은 이 URL로 page_view를 보낸다.
              2. 공개 목적지에는 `rel="noreferrer"` — 사이트 Referrer-Policy가
                 strict-origin-when-cross-origin이라 **동일 출처 이동에는 전체 URL**을 보낸다.
                 없으면 도착지 gtag가 page_referrer에 토큰·paymentKey를 실어 보낸다.
                 private→private 링크(관리·입금 안내)는 도착지도 측정 대상이 아니라 불필요. */}
          <dl className="mt-5 space-y-3">
            {[
              { k: '프로젝트', v: <a href={`/ko/funding/${p.projectSlug}`} rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">{p.projectTitle}</a> },
              { k: '리워드', v: `${p.rewardTitle} × ${p.quantity}${p.additionalAmount > 0 ? ` + 추가 후원 ${formatPriceAmount(p.additionalAmount)}원` : ''}` },
              { k: '금액', v: `${formatPriceAmount(p.totalAmount)}원 (VAT 포함)` },
              ...(status === 'paid' ? [{ k: '리워드 발송', v: FULFILL_LABEL[p.fulfillmentStatus] }] : []),
              ...(p.shipping ? [{ k: '배송지', v: p.shipping }] : []),
              {
                k: '이름 공개',
                v: p.canEditDisplayName ? (
                  <label className="inline-flex items-center justify-end gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={displayNamePublic}
                      disabled={nameBusy}
                      aria-label="후원자 명단에 이름 공개"
                      onChange={(e) => void updateDisplayName(e.target.checked)}
                    />
                    <span>{displayNamePublic ? '공개' : '비공개'}</span>
                  </label>
                ) : (
                  displayNamePublic ? '공개' : '비공개'
                ),
              },
              { k: '주문번호', v: p.orderNo },
            ].map((row) => (
              <div key={row.k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-200/70 pb-3 last:border-0 last:pb-0 dark:border-gray-700/70">
                <dt className="typo-card-meta shrink-0">{row.k}</dt>
                <dd className="min-w-0 text-right text-sm font-medium text-gray-900 dark:text-white">{row.v}</dd>
              </div>
            ))}
          </dl>

          {status === 'paid' && !refundRequested && (p.canCancel
            ? <Button className="mt-6" variant="outline" fullWidth onClick={cancel} disabled={busy}>후원 취소 (전액 환불)</Button>
            : <p className="typo-card-meta mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">{p.cancelBlockedReason} 문의: 010-4255-7893 · hello@studionol.co.kr</p>)}
          {confirmMessage && (
            <p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300">{confirmMessage}</p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{error}</p>
          )}
        </div>

        {/* 전자상거래법 제13조 2항 — 계약 성립 뒤 후원자가 도달하는 문서에는 청약철회·환불 조건에
            닿는 경로가 있어야 한다. 이 화면은 FundingTrustNotice를 두르지 않아 링크가 없었다.
            공개 목적지라 rel="noreferrer" — 이 URL에는 관리 토큰이 실린다(위 주석 참조). */}
        <p className="typo-card-meta mt-6">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link 클라 전환으로 나갔다 뒤로가기를 누르면 gtag가 토큰 붙은 이 URL로 page_view를 보낸다(위 주석). 문서 이동으로 유지한다. */}
          <a href="/ko/funding/terms" rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">펀딩 약관·청약철회·환불 규정</a>
          {' · '}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- next/link 클라 전환으로 나갔다 뒤로가기를 누르면 gtag가 토큰 붙은 이 URL로 page_view를 보낸다(위 주석). 문서 이동으로 유지한다. */}
          <a href="/ko/privacy-policy" rel="noreferrer" className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">개인정보 처리방침</a>
        </p>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  denyContractPageCaching(context.res);
  const { locale, orderNo } = context.params as { locale: string; orderNo: string };
  if (locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const token = context.query.token;
  if (typeof token !== 'string' || !token) return { notFound: true };
  const now = new Date();
  await expireStalePledges(now);
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order?.fundingPledge || !isTokenMatch(order.manageToken, token)) return { notFound: true };
  const pl = order.fundingPledge;
  const project = getFundingProject(pl.projectSlug);
  const verdict = assessSelfCancel({ orderStatus: order.status, projectState: project ? computeProjectState(project, now) : 'closed', fulfillmentStatus: pl.fulfillmentStatus, paymentMethod: pl.paymentMethod });
  const shipping = pl.shippingAddress1 ? `${pl.shippingName} · ${pl.shippingPhone} · (${pl.shippingPostcode}) ${pl.shippingAddress1} ${pl.shippingAddress2 ?? ''}` : null;
  return { props: {
    orderNo: order.orderNo, token, projectSlug: pl.projectSlug, projectTitle: project?.title ?? pl.projectSlug, rewardTitle: pl.rewardTitle,
    quantity: pl.quantity, additionalAmount: pl.additionalAmount, totalAmount: order.totalAmount, status: order.status,
    paymentMethod: pl.paymentMethod, fulfillmentStatus: pl.fulfillmentStatus, shipping,
    canCancel: verdict.ok, cancelBlockedReason: verdict.ok ? null : CANCEL_BLOCK_MESSAGES[verdict.code],
    refundRequested: pl.refundRequestedAt !== null,
    displayNamePublic: pl.displayNamePublic,
    // 이름이 공개돼 있거나 앞으로 공개될 수 있는 상태에서만 바꾼다
    // (pages/api/funding/display-name.ts의 EDITABLE_STATUSES와 같은 판정).
    canEditDisplayName: ['pending', 'paid', 'partially_refunded'].includes(order.status),
  } };
};
