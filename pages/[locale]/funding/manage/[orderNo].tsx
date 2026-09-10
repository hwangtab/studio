import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
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
  canCancel: boolean; cancelBlockedReason: string | null; refundRequested: boolean; depositUrl: string | null;
}
const STATUS_LABEL: Record<string, string> = { pending: '결제 대기', paid: '후원 확정', partially_refunded: '일부 환불', refunded: '환불 완료', expired: '만료', failed: '결제 실패' };
const FULFILL_LABEL: Record<string, string> = { none: '준비 전', preparing: '발송 준비 중', shipped: '발송 완료', delivered: '전달 완료' };

export default function FundingManagePage(p: Props) {
  const [status, setStatus] = useState(p.status);
  const [refundRequested, setRefundRequested] = useState(p.refundRequested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const cancel = async () => {
    const confirmText = p.paymentMethod === 'bank_transfer'
      ? '취소를 요청할까요? 환불은 운영자가 계좌로 진행합니다.'
      : `후원을 취소하고 ${formatPriceAmount(p.totalAmount)}원을 환불받을까요?`;
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
      <main className="mx-auto max-w-xl px-4 pb-24 pt-28 sm:pt-32">
        <h1 className="typo-section-title">후원 확인</h1>
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

          <dl className="mt-5 space-y-3">
            {[
              { k: '프로젝트', v: <Link href={`/ko/funding/${p.projectSlug}`} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">{p.projectTitle}</Link> },
              { k: '리워드', v: `${p.rewardTitle} × ${p.quantity}${p.additionalAmount > 0 ? ` + 추가 후원 ${formatPriceAmount(p.additionalAmount)}원` : ''}` },
              { k: '금액', v: `${formatPriceAmount(p.totalAmount)}원 (VAT 포함)` },
              ...(status === 'paid' ? [{ k: '리워드 발송', v: FULFILL_LABEL[p.fulfillmentStatus] }] : []),
              ...(p.shipping ? [{ k: '배송지', v: p.shipping }] : []),
              { k: '주문번호', v: p.orderNo },
            ].map((row) => (
              <div key={row.k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-200/70 pb-3 last:border-0 last:pb-0 dark:border-gray-700/70">
                <dt className="typo-card-meta shrink-0">{row.k}</dt>
                <dd className="min-w-0 text-right text-sm font-medium text-gray-900 dark:text-white">{row.v}</dd>
              </div>
            ))}
          </dl>

          {status === 'pending' && p.depositUrl && (
            <p className="typo-card-meta mt-5">
              <Link href={p.depositUrl} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-light">무통장입금 안내 보기</Link>
            </p>
          )}
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
  const verdict = assessSelfCancel({ orderStatus: order.status, projectState: project ? computeProjectState(project, now) : 'closed', fulfillmentStatus: pl.fulfillmentStatus });
  const shipping = pl.shippingAddress1 ? `${pl.shippingName} · ${pl.shippingPhone} · (${pl.shippingPostcode}) ${pl.shippingAddress1} ${pl.shippingAddress2 ?? ''}` : null;
  return { props: {
    orderNo: order.orderNo, token, projectSlug: pl.projectSlug, projectTitle: project?.title ?? pl.projectSlug, rewardTitle: pl.rewardTitle,
    quantity: pl.quantity, additionalAmount: pl.additionalAmount, totalAmount: order.totalAmount, status: order.status,
    paymentMethod: pl.paymentMethod, fulfillmentStatus: pl.fulfillmentStatus, shipping,
    canCancel: verdict.ok, cancelBlockedReason: verdict.ok ? null : CANCEL_BLOCK_MESSAGES[verdict.code],
    refundRequested: pl.refundRequestedAt !== null,
    depositUrl: pl.paymentMethod === 'bank_transfer' ? `/ko/funding/deposit/${order.orderNo}?token=${token}` : null,
  } };
};
