import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { patchPledge, type FundingActionResult } from '../../../components/admin/fundingActions';
import { AdminShell } from '../../../components/admin/AdminShell';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextArea, TextInput } from '../../../components/ui/Field';
import { lightOnlyField } from '../../../components/ui/adminFieldClass';
import { formatPriceAmount } from '../../../data/pricing';
import { authenticateAdminRequest } from '../../../lib/contracts/admin-auth';
import { formatKstDateTime, formatKstDateTimeFull } from '../../../lib/booking/format';
import { serializePledgeForAdmin, type AdminPledgeItem } from '../../../lib/funding/admin-serialize';
import { FULFILLMENT_LABELS, FULFILLMENT_STATUS_ORDER } from '../../../lib/funding/fulfillmentLabels';
import { isLiveFundingOrderStatus, remainingRefundable } from '../../../lib/funding/refundable';
import { findFundingOrderById } from '../../../lib/funding/service';
import { describeNotificationError } from '../../../lib/ops/notificationSentinel';

interface AdminFundingDetailPageProps {
  pledge: AdminPledgeItem;
  /** 아직 환불하지 않은 금액 = totalAmount − 기록된 done 환불 합. 부분환불 건에서 totalAmount와 다르다. */
  refundableAmount: number;
}

export const getServerSideProps: GetServerSideProps<AdminFundingDetailPageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') return { notFound: true };

  const order = await findFundingOrderById(id).catch((error: unknown) => {
    console.error('[admin/funding/[id]] Failed to load pledge:', error);
    return undefined;
  });
  if (!order || !order.fundingPledge) return { notFound: true };

  // 취소 로직과 같은 헬퍼를 쓴다 — 화면이 보여주는 잔액과 실제 환불액이 갈리면 관리자가
  // 확인창에서 본 금액과 다른 금액이 나간다.
  const refundableAmount = remainingRefundable(order);

  return { props: { pledge: serializePledgeForAdmin(order), refundableAmount } };
};

const STATUS_LABELS: Record<string, string> = {
  pending: '결제대기',
  paid: '확정',
  partially_refunded: '부분환불',
  refunded: '환불완료',
  failed: '결제실패',
  expired: '만료',
};

const PAYMENT_LABELS: Record<string, string> = { toss: '카드', bank_transfer: '무통장' };
const FULFILLMENT_OPTIONS = FULFILLMENT_STATUS_ORDER;

const DescriptionRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

export default function AdminFundingDetailPage({ pledge, refundableAmount }: AdminFundingDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [fulfillmentStatus, setFulfillmentStatus] = useState(pledge.fulfillmentStatus);
  const [trackingCompany, setTrackingCompany] = useState(pledge.trackingCompany ?? '');
  const [trackingNumber, setTrackingNumber] = useState(pledge.trackingNumber ?? '');
  const [memo, setMemo] = useState(pledge.adminMemo ?? '');

  // 센티널(`send_pending`·`send_inflight`)과 실제 실패 사유를 갈라 읽는다 — 원문 노출 금지.
  const notificationCopy = describeNotificationError(pledge.notificationError);

  /**
   * 서버가 메모를 바꾸면 textarea를 따라가게 한다.
   *
   * run()의 router.replace는 props만 갱신하고 이 컴포넌트를 remount하지 않는다. 그래서
   * '환불 요청 취소'가 adminMemo에 `[날짜] 환불 요청 취소 — 사유`를 덧붙여도 textarea에는
   * append 이전 값이 남아 있었고, 이어서 '메모 저장'을 누르면 set_memo가 그 옛 값으로
   * 통째로 덮어써 방금 남긴 청약철회 기록이 사라졌다 — 흔적을 남기려고 만든 장치가 같은
   * 화면의 다음 클릭 한 번으로 무너진다.
   *
   * 의존성은 서버 값 하나뿐이라, 서버 값이 그대로인 다른 액션(입금 확인·발송 저장)에서는
   * 이 effect가 다시 돌지 않는다. 즉 아직 저장하지 않은 입력은 지워지지 않는다.
   */
  useEffect(() => {
    setMemo(pledge.adminMemo ?? '');
  }, [pledge.adminMemo]);

  const run = async (task: () => Promise<FundingActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setNotice(null);
    const result = await task();
    setBusy(false);
    if (!result.ok) setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  // 부분환불 건도 잔액이 남아 있으면 관리자가 마저 환불할 수 있어야 한다.
  const canRefund = isLiveFundingOrderStatus(pledge.status);

  const handleRefund = () => run(() => patchPledge(pledge.id, { action: 'refund', reason: '관리자 환불' }), `이 펀딩의 남은 금액 ${formatPriceAmount(refundableAmount)}원을 환불할까요? 되돌릴 수 없습니다.`);
  const handleSaveFulfillment = () =>
    run(() => patchPledge(pledge.id, { action: 'set_fulfillment', fulfillmentStatus, trackingCompany, trackingNumber }));
  const handleSaveMemo = () => run(() => patchPledge(pledge.id, { action: 'set_memo', adminMemo: memo || undefined }));
  /**
   * 확인을 받는다 — 이 버튼은 상태와 무관하게 **항상** 렌더되는데 누르면 곧바로 고객에게
   * 메일이 나간다. 되돌릴 수 없는 대외 발송에 확인이 없던 유일한 자리였다.
   * 무엇이 나가는지도 함께 알린다(확정 안내인지 환불 안내인지가 주문 상태로 갈린다).
   */
  const handleResendEmail = () =>
    run(
      () => patchPledge(pledge.id, { action: 'resend_email' }),
      `${pledge.customerEmail}로 ${isLiveFundingOrderStatus(pledge.status) ? '펀딩 확정' : '환불'} 안내 메일을 다시 보낼까요?`,
    );
  /**
   * 고객이 남긴 청약철회 의사를 지우는 조작이라 사유를 반드시 받는다(API도 없으면 400).
   * 사유는 관리자 메모에 날짜와 함께 덧붙고, 후원자에게는 확인 메일이 나간다.
   */
  const handleClearRefundRequest = () => {
    const reason = window.prompt(
      '서포터가 직접 철회 의사를 밝힌 경우에만 사용하세요. 사유를 적어 주세요 (관리자 메모에 남고 서포터에게 확인 메일이 나갑니다).',
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('환불 요청을 취소하려면 사유를 입력해야 합니다.');
      return;
    }
    return run(() => patchPledge(pledge.id, { action: 'clear_refund_request', reason: reason.trim() }));
  };

  /**
   * needsReview를 끄는 유일한 경로. 해제 경로가 없는 경고는 첫 사용 직후 경보 피로로
   * 죽는다 — 환불 요청 취소와 같은 모양(사유 필수·메모 append)을 그대로 쓴다.
   */
  const handleClearStockReview = () => {
    const reason = window.prompt(
      '한정 리워드 재고를 확인한 뒤에 닫아 주세요. 확인 내용을 적어 주세요 (관리자 메모에 날짜와 함께 남습니다).',
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('재고 확인을 닫으려면 확인 내용을 입력해야 합니다.');
      return;
    }
    return run(() => patchPledge(pledge.id, { action: 'clear_stock_review', reason: reason.trim() }));
  };

  /**
   * 내려받기 기록을 지운다 — 막혀 있던 셀프 취소가 되살아난다.
   *
   * "파일은 못 받았는데 기록만 남은" 건을 바로잡는 자리다. 실제로 CSP가 내려받기
   * 리디렉트를 막는 동안 그 상태가 만들어졌다(#153). 원인은 고쳤지만 되돌릴 수단이
   * 없으면 같은 형태의 사고에서 운영자가 DB를 직접 만져야 한다.
   *
   * 다른 해제 조작과 같은 모양 — 사유 필수, 관리자 메모에 날짜와 함께 남는다.
   */
  const handleClearDownloadRecord = () => {
    const reason = window.prompt(
      '서포터가 파일을 받지 못했다고 확인된 경우에만 사용하세요. 사유를 적어 주세요 (관리자 메모에 날짜와 함께 남습니다).',
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setNotice('내려받기 기록을 지우려면 사유를 입력해야 합니다.');
      return;
    }
    return run(() => patchPledge(pledge.id, { action: 'clear_download_record', reason: reason.trim() }));
  };

  // 환불 요청이 걸린 건은 발송 상태를 바꿀 수 없다(API도 409로 막는다) — 청약철회한
  // 사람에게 실물이 나가는 것을 막는 게 이 화면의 유일한 목적이다.
  //
  // 상태 판정은 API·CSV·집계와 같은 헬퍼를 쓴다. 화면만 'paid'로 굳어 있으면 서버가 허용하는
  // 조작을 화면이 막는(또는 그 반대의) 조합이 다시 생긴다 — 부분환불 건이 정확히 그랬다.
  const fulfillmentLocked = !isLiveFundingOrderStatus(pledge.status) || pledge.refundRequested;

  return (
    <>
      <Head>
        <title>{pledge.customerName}님 펀딩 상세 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="펀딩 상세"
        description={`${pledge.customerName} · ${pledge.orderNo}`}
        backHref="/admin/funding"
        backLabel="펀딩 목록"
      >
        {notice && <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>}

          {pledge.mismatch && (
            <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
              <strong className="block mb-1">결제 기록과 주문 상태 불일치 — 토스 콘솔 확인 필요</strong>
              주문 상태는 “{STATUS_LABELS[pledge.status] ?? pledge.status}”인데 결제 기록이 있습니다.
            </div>
          )}

          {pledge.virtualAccountPayment && (
            <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-900 rounded-lg text-sm">
              <strong className="block mb-1">가상계좌 결제 — 화면에서 환불할 수 없습니다</strong>
              토스는 가상계좌 취소에 환불받을 계좌(은행·계좌번호·예금주)를 필수로 요구하는데, 우리는 그 값을
              받는 화면이 없습니다. 아래 “환불”을 눌러도 실패합니다.
              <span className="block mt-2">
                서포터에게 환불 계좌를 받아 <strong>토스 콘솔에서 직접 취소</strong>해 주세요. 약관 제10조에 따라
                접수일부터 3영업일 이내입니다. 취소하면 웹훅 대사가 이 화면의 상태를 맞춥니다.
              </span>
            </div>
          )}

          {pledge.refundRequested && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-300 text-orange-900 rounded-lg text-sm">
              <strong className="block mb-1">서포터가 취소를 요청했습니다 — 계좌 환불 대기</strong>
              {pledge.refundRequestedAt ? `${formatKstDateTimeFull(pledge.refundRequestedAt)}에 접수되었습니다. ` : ''}
              무통장은 자동 환불이 되지 않아 운영자가 계좌로 직접 송금해야 합니다.
              약관 제10조에 따라 접수일부터 3영업일 이내에 처리해 주세요.
              <span className="block mt-2">
                <strong>이 펀딩은 발송하면 안 됩니다.</strong> 아래 “환불”로 처리하거나, 서포터가 요청을 철회했다면
                “환불 요청 취소”를 누른 뒤에 발송 상태를 바꿀 수 있습니다. 철회 처리에는 사유가 필요하며,
                사유는 관리자 메모에 남고 서포터에게 확인 메일이 나갑니다.
              </span>
            </div>
          )}

          {pledge.needsReview && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-300 text-purple-900 rounded-lg text-sm">
              <strong className="block mb-1">웹훅이 되살려 확정한 펀딩 — 재고 확인 필요</strong>
              홀드가 만료된(또는 실패 처리된) 뒤 결제가 승인된 건이라 <strong>한정 리워드 재고를
              초과했을 수 있습니다.</strong> 아래 관리자 메모에 웹훅이 남긴 원문이 있습니다.
              <span className="block mt-2">
                남은 수량을 확인한 뒤 “재고 확인 완료”를 누르면 이 경고가 꺼집니다. 확인 내용은
                관리자 메모에 날짜와 함께 남습니다.
              </span>
            </div>
          )}

          {/* notificationError는 자유 문자열이 아니다 — 확정 후처리 소유권 CAS가 쓰는
              `send_pending`·`send_inflight`가 같은 칸에 들어온다. 원문을 그대로 찍으면
              "알림 발송에 실패했습니다 send_inflight"가 되어 정상 진행 중인 펀딩을 사고로
              읽게 만든다(lib/ops/notificationSentinel.ts). */}
          {notificationCopy && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              <strong className="block mb-1">{notificationCopy.title}</strong>
              {notificationCopy.detail}
              <span className="block mt-2 text-amber-700">아래 “메일 재발송”을 눌러 다시 보내 주세요.</span>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-3">기본 정보</h2>
              <dl className="space-y-2 text-sm">
                <DescriptionRow label="주문번호" value={pledge.orderNo} />
                <DescriptionRow label="프로젝트" value={pledge.projectSlug} />
                <DescriptionRow label="상태" value={STATUS_LABELS[pledge.status] ?? pledge.status} />
                <DescriptionRow label="결제수단" value={PAYMENT_LABELS[pledge.paymentMethod] ?? pledge.paymentMethod} />
                <DescriptionRow label="등록 경로" value={pledge.entrySource === 'manual' ? '수기 등록' : '온라인'} />
                <DescriptionRow label="고객" value={`${pledge.customerName} / ${pledge.customerPhone} / ${pledge.customerEmail}`} />
                <DescriptionRow label="리워드" value={`${pledge.rewardTitle} × ${pledge.quantity}`} />
                <DescriptionRow label="추가 펀딩 금액" value={`${formatPriceAmount(pledge.additionalAmount)}원`} />
                <DescriptionRow label="합계" value={`${formatPriceAmount(pledge.totalAmount)}원`} />
                <DescriptionRow label="발송 상태" value={FULFILLMENT_LABELS[pledge.fulfillmentStatus] ?? pledge.fulfillmentStatus} />
                <DescriptionRow label="배송지" value={pledge.shipping ?? '없음'} />
                <DescriptionRow label="응원 메시지" value={pledge.supporterMessage ?? '없음'} />
                <DescriptionRow label="환불 요청 시각" value={pledge.refundRequestedAt ? formatKstDateTimeFull(pledge.refundRequestedAt) : '없음'} />
                <DescriptionRow label="확정 시각" value={pledge.paidAt ? formatKstDateTimeFull(pledge.paidAt) : '없음'} />
                {/* 결제창에서 승인이 안 난 사유. 컬럼은 있었는데 읽는 화면이 없어, 문의가
                    오면 토스 대시보드를 열어야만 확인할 수 있었다. 값이 있을 때만 보인다 —
                    정상 확정된 건에 빈 줄을 세 개 늘릴 이유가 없다. */}
                {pledge.paymentFailedAt && (
                  <DescriptionRow
                    label="결제 실패"
                    value={`${pledge.paymentFailCode ?? '코드 없음'} · ${formatKstDateTimeFull(pledge.paymentFailedAt)}${pledge.paymentFailMessage ? ` — ${pledge.paymentFailMessage}` : ''}`}
                  />
                )}
                {/* 값이 있으면 셀프 취소가 막혀 있다는 뜻이다 — 문의를 받았을 때 먼저 볼 자리다. */}
                <DescriptionRow
                  label="내려받기 시작"
                  value={pledge.downloadedAt ? `${formatKstDateTimeFull(pledge.downloadedAt)} (셀프 취소 불가)` : '없음'}
                />
                <DescriptionRow label="결제 홀드 만료" value={formatKstDateTimeFull(pledge.holdExpiresAt)} />
                <DescriptionRow label="접수 시각" value={formatKstDateTime(pledge.createdAt)} />
              </dl>
            </div>

            <div className="flex flex-wrap gap-2">
              {canRefund && (
                <Button light variant="secondary" disabled={busy} onClick={handleRefund}>환불</Button>
              )}
              {pledge.refundRequested && isLiveFundingOrderStatus(pledge.status) && (
                <Button light variant="outline" disabled={busy} onClick={handleClearRefundRequest}>환불 요청 취소</Button>
              )}
              {pledge.needsReview && (
                <Button light variant="outline" disabled={busy} onClick={handleClearStockReview}>재고 확인 완료</Button>
              )}
              {pledge.downloadedAt && (
                <Button light variant="outline" disabled={busy} onClick={handleClearDownloadRecord}>내려받기 기록 초기화</Button>
              )}
              <Button light variant="outline" disabled={busy} onClick={handleResendEmail}>메일 재발송</Button>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-3">발송 상태</h2>
              <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-xl">
                <Field id="fulfillment-status" label="상태" className={lightOnlyField}>
                  <Select
                    value={fulfillmentStatus}
                    onChange={(e) => setFulfillmentStatus(e.target.value as typeof fulfillmentStatus)}
                    light className="w-auto text-sm"
                    disabled={fulfillmentLocked}
                  >
                    {FULFILLMENT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{FULFILLMENT_LABELS[s]}</option>
                    ))}
                  </Select>
                </Field>
                <Field id="tracking-company" label="택배사" className={lightOnlyField}>
                  <TextInput
                    type="text"
                    value={trackingCompany}
                    onChange={(e) => setTrackingCompany(e.target.value)}
                    light className="w-auto text-sm"
                    disabled={fulfillmentLocked}
                  />
                </Field>
                <Field id="tracking-number" label="운송장번호" className={lightOnlyField}>
                  <TextInput
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    light className="w-auto text-sm"
                    disabled={fulfillmentLocked}
                  />
                </Field>
                <Button light disabled={busy || fulfillmentLocked} onClick={handleSaveFulfillment}>저장</Button>
              </div>
              {!isLiveFundingOrderStatus(pledge.status) && (
                <p className="mt-2 text-xs text-gray-500">확정된 펀딩만 발송 상태를 바꿀 수 있습니다.</p>
              )}
              {isLiveFundingOrderStatus(pledge.status) && pledge.refundRequested && (
                <p className="mt-2 text-xs text-orange-700">
                  환불 요청된 펀딩입니다. 환불을 처리하거나 요청을 취소한 뒤에 발송 상태를 바꿀 수 있습니다.
                </p>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-3">관리자 메모</h2>
              <div className="flex flex-col gap-3">
                <TextArea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  aria-label="관리자 메모"
                  light className="min-h-0 text-sm"
                />
                <Button light disabled={busy} onClick={handleSaveMemo} className="self-start">메모 저장</Button>
              </div>
            </div>
          </div>
      </AdminShell>
    </>
  );
}
