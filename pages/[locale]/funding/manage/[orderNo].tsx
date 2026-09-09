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
      <main className="mx-auto max-w-lg px-4 pb-24 pt-28">
        <h1 className="text-2xl font-bold">후원 확인</h1>
        <dl className="mt-6 space-y-2 text-sm">
          <div><dt className="text-gray-500">프로젝트</dt><dd><Link href={`/ko/funding/${p.projectSlug}`} className="underline">{p.projectTitle}</Link></dd></div>
          <div><dt className="text-gray-500">리워드</dt><dd>{p.rewardTitle} × {p.quantity}{p.additionalAmount > 0 ? ` + 추가 후원 ${formatPriceAmount(p.additionalAmount)}원` : ''}</dd></div>
          <div><dt className="text-gray-500">금액</dt><dd>{formatPriceAmount(p.totalAmount)}원 (VAT 포함)</dd></div>
          <div><dt className="text-gray-500">상태</dt><dd>{STATUS_LABEL[status] ?? status}{refundRequested && status === 'paid' ? ' · 환불 요청 접수' : ''}</dd></div>
          {status === 'paid' && <div><dt className="text-gray-500">리워드 발송</dt><dd>{FULFILL_LABEL[p.fulfillmentStatus]}</dd></div>}
          {p.shipping && <div><dt className="text-gray-500">배송지</dt><dd>{p.shipping}</dd></div>}
          <div><dt className="text-gray-500">주문번호</dt><dd>{p.orderNo}</dd></div>
        </dl>
        {status === 'pending' && p.depositUrl && <p className="mt-6"><Link href={p.depositUrl} className="underline">무통장입금 안내 보기</Link></p>}
        {status === 'paid' && !refundRequested && (p.canCancel
          ? <Button className="mt-8" variant="outline" onClick={cancel} disabled={busy}>후원 취소 (전액 환불)</Button>
          : <p className="mt-8 text-sm text-gray-500">{p.cancelBlockedReason} 문의: 010-4255-7893 · hello@studionol.co.kr</p>)}
        {confirmMessage && <p role="status" className="mt-3 text-green-700">{confirmMessage}</p>}
        {error && <p role="alert" className="mt-3 text-red-600">{error}</p>}
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
