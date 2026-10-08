import { useState } from 'react';
import { withI18nServerProps } from '../../../../lib/getStatic';
import Head from 'next/head';
import { Button } from '../../../../components/ui/Button';
import { Badge } from '../../../../components/ui/Badge';
import { Notice } from '../../../../components/ui/Notice';
import { PageHeader, PageShell } from '../../../../components/ui/PageHeader';
import { Panel } from '../../../../components/ui/Panel';
import { formatPriceAmount } from '../../../../data/pricing';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { assessSelfCancel, canWithdrawBeforeDeposit, cancelBlockedMessage, showsMessageAnonymously } from '../../../../lib/funding/policy';
import { isOnlineBankTransfer } from '../../../../lib/funding/bankAccount';
import { REFUND_ACCOUNT_LIMITS } from '../../../../lib/payments/bankAccount';
import BankDepositGuide from '../../../../components/payments/BankDepositGuide';
import { Field, TextInput } from '../../../../components/ui/Field';
import { FUNDING_ORDER_STATUS_LABELS } from '../../../../lib/funding/fulfillmentLabels';
import { isLiveFundingOrderStatus } from '../../../../lib/funding/refundable';
import { isPastFundingEnd } from '../../../../lib/funding/projectState';
import { getFundingProjectOrFailure } from '../../../../lib/funding/repository';
import { expireStalePledges, findFundingOrderByOrderNo } from '../../../../lib/funding/service';
import SupporterListingEditor from '../../../../components/funding/SupporterListingEditor';
import { activePledgeLines, pledgeLines, pledgeLinesLabel } from '../../../../lib/funding/pledgeLines';
import { pledgeDownloads } from '../../../../lib/funding/shape';

interface Props {
  orderNo: string; token: string; projectSlug: string; projectTitle: string;
  /** 담은 리워드 요약 — "『발작』 × 1, 『갱도』 × 1"(pledgeLinesLabel). */
  rewardLabel: string; additionalAmount: number;
  totalAmount: number; status: string; paymentMethod: string; fulfillmentStatus: string; shipping: string | null;
  canCancel: boolean; cancelBlockedReason: string | null; refundRequested: boolean;
  /**
   * 셀프 취소가 되면 돈이 어디로 돌아가는가(assessSelfCancel의 refundVia). `bank_account`면 취소
   * 버튼이 먼저 환불 계좌 입력 칸을 연다. 취소할 수 없으면 null.
   */
  refundVia: 'card' | 'bank_account' | null;
  /**
   * 입금을 기다리는 계좌 입금 신청이면 안내에 쓸 값(금액·기한·이름 — 전부 서버가 다시 읽은 값).
   * 아니면 null. 이 값이 있으면 화면은 계좌 안내를 그리고 "입금 전 신청 취소"를 둔다.
   */
  deposit: { amount: number; deadline: string; customerName: string } | null;
  /** 이 후원이 온라인 계좌 입금인가 — 취소된(만료) 신청에 늦은 입금 안내를 붙일지 가른다. */
  onlineBankTransfer: boolean;
  /**
   * 프로젝트 조회가 **실패**했는가(부재가 아니다). true면 이 화면은 취소·내려받기 판정을
   * 할 근거가 없으므로 마감이라고 말하지 않고 일시 오류로 안내한다.
   */
  lookupFailed: boolean;
  /** 디지털 리워드 내려받기 주소. 결제가 살아 있는 건에만 내려보낸다. */
  downloads: Array<{ label: string; key: string }>;
  /** 후원자 명단 이름 공개 동의 여부와, 지금 그것을 바꿀 수 있는지. */
  displayNamePublic: boolean; canEditDisplayName: boolean;
  /** 명단 표시 이름 편집에 쓰는 값 — 결제자 이름, 저장된 표시 이름(`public_name`), 응원 메시지. */
  customerName: string; publicName: string | null; supporterMessage: string | null;
  /** 운영자가 명단에서 내렸는가(`listing_hidden_at`). */
  listingHidden: boolean;
  /** 이름을 내려도 메시지가 "익명"으로 남는 판본인가(`showsMessageAnonymously`). */
  messageShownAnonymously: boolean;
}
const FULFILL_LABEL: Record<string, string> = { none: '준비 전', preparing: '발송 준비 중', shipped: '발송 완료', delivered: '전달 완료' };

export default function FundingManagePage(p: Props) {
  const [status, setStatus] = useState(p.status);
  const [refundRequested, setRefundRequested] = useState(p.refundRequested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  // 셀프 취소 직후에는 SSR props(downloads·canEditDisplayName)가 낡았다. 상태에서 파생해
  // 취소된 건에는 내려받기와 명단 편집을 그리지 않는다(success.tsx의 not_live와 같은 판정).
  const isLive = isLiveFundingOrderStatus(status);

  // 계좌 입금 후원의 취소 — 환불 계좌를 먼저 받는다(서버가 암호화해 저장한다).
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [refundAccount, setRefundAccount] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const [deposit, setDeposit] = useState(p.deposit);

  const withdraw = async () => {
    if (!window.confirm('입금 전 신청을 취소할까요? 이미 입금하셨다면 취소하지 말고 010-4255-7893으로 연락 주세요.')) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/funding/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo: p.orderNo, token: p.token }) });
      if (!res.headers.get('content-type')?.includes('application/json')) { setError('서버 오류가 발생했습니다.'); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '취소하지 못했습니다.'); return; }
      setDeposit(null);
      setStatus('expired');
      setConfirmMessage('신청을 취소했습니다. 받은 돈이 없어 환불할 금액은 없습니다.');
    } catch { setError('네트워크 오류가 발생했습니다.'); } finally { setBusy(false); }
  };

  const cancel = async () => {
    const viaAccount = p.refundVia === 'bank_account';
    if (viaAccount && !accountFormOpen) { setAccountFormOpen(true); return; }
    const confirmText = viaAccount
      ? `펀딩을 취소하고 ${formatPriceAmount(p.totalAmount)}원을 ${refundAccount.bankName.trim()} 계좌로 환불받을까요?`
      : `펀딩을 취소하고 ${formatPriceAmount(p.totalAmount)}원을 환불받을까요?`;
    if (!window.confirm(confirmText)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/funding/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo: p.orderNo, token: p.token, ...(viaAccount ? { refundAccount } : {}) }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        setError('서버 오류가 발생했습니다.');
        return;
      }
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '취소에 실패했습니다.'); return; }
      // 계좌 입금 후원 — 취소를 접수했고, 운영자가 적어 주신 계좌로 송금한다.
      if (json.mode === 'refund_requested') {
        setRefundRequested(true);
        setAccountFormOpen(false);
        setRefundAccount({ bankName: '', accountNumber: '', accountHolder: '' });
        setConfirmMessage(`취소 요청을 접수했습니다. ${formatPriceAmount(json.refundAmount ?? p.totalAmount)}원을 적어 주신 계좌로 접수일부터 3영업일 이내에 보내 드립니다.`);
      } else {
        setStatus('refunded');
        setConfirmMessage(`취소되었습니다. ${formatPriceAmount(json.refundAmount ?? p.totalAmount)}원이 환불됩니다.`);
      }
    } catch { setError('네트워크 오류가 발생했습니다.'); } finally { setBusy(false); }
  };
  return (
    <>
      <Head><title>펀딩 확인 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <PageShell>
        {/* 사이트 헤더를 두르지 않는 화면이라(components/Layout.tsx의 isPrivatePaymentPage)
            여기가 브랜드를 밝히는 유일한 자리다 — 메일 링크로 들어온 사람이 어디서 온
            화면인지 알 수 있어야 한다(tests/pages/privateLinkNavigation.test.ts가 이 전용 줄을 요구한다).
            뒤로 링크(backHref)는 두지 않는다 — next/link라 이 화면의 이탈 규칙(아래 privatePaths
            주석)에 어긋난다. */}
        <p className="typo-card-meta">스튜디오 놀</p>
        <PageHeader title="펀딩 확인" lead="펀딩 내역과 진행 상태를 확인하고, 조건이 되면 여기서 취소할 수 있습니다." />

        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={deposit ? 'warning' : status === 'paid' ? 'brand' : 'neutral'} size="md">
              {deposit ? '입금 대기' : (FUNDING_ORDER_STATUS_LABELS[status] ?? status)}
            </Badge>
            {refundRequested && status === 'paid' && <Badge tone="warning" size="md">환불 요청 접수</Badge>}
          </div>

          {deposit && <BankDepositGuide amount={deposit.amount} deadline={deposit.deadline} customerName={deposit.customerName} applicantLabel="신청하신 분" />}
          {!deposit && p.onlineBankTransfer && status === 'expired' && (
            <Panel variant="outline" className="mt-5 text-base">
              이 계좌 입금 신청은 취소되었습니다. 이미 입금하셨다면 010-4255-7893 · hello@studionol.co.kr로 알려 주세요 — 확인한 뒤 펀딩을 확정해 드립니다.
            </Panel>
          )}

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
              { k: '리워드', v: `${p.rewardLabel}${p.additionalAmount > 0 ? ` + 추가 펀딩 ${formatPriceAmount(p.additionalAmount)}원` : ''}` },
              { k: '금액', v: `${formatPriceAmount(p.totalAmount)}원 (VAT 포함)` },
              ...(status === 'paid' ? [{ k: '리워드 발송', v: FULFILL_LABEL[p.fulfillmentStatus] }] : []),
              ...(p.shipping ? [{ k: '배송지', v: p.shipping }] : []),
              // 바꿀 수 있으면 아래 SupporterListingEditor가 상태를 보여 주고 바꾼다(약관 제13조
              // 2항의 철회도 거기서). 여기 읽기 전용 줄을 함께 두면 저장 뒤에도 옛 값이 남는다 —
              // 그래서 바꿀 수 없는 상태(환불 등)에서만 이 줄을 둔다.
              ...(p.canEditDisplayName && isLive ? [] : [{ k: '이름 공개', v: p.displayNamePublic ? '공개' : '비공개' }]),
              { k: '주문번호', v: p.orderNo },
            ].map((row) => (
              <div key={row.k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-200/70 pb-3 last:border-0 last:pb-0 dark:border-gray-700/70">
                <dt className="typo-card-meta shrink-0">{row.k}</dt>
                <dd className="min-w-0 text-right text-sm font-medium text-gray-900 dark:text-white">{row.v}</dd>
              </div>
            ))}
          </dl>

          {p.canEditDisplayName && isLive && (
            <SupporterListingEditor
              variant="manage"
              orderNo={p.orderNo}
              token={p.token}
              customerName={p.customerName}
              initialPublic={p.displayNamePublic}
              initialPublicName={p.publicName}
              message={p.supporterMessage}
              hiddenByOperator={p.listingHidden}
              messageShownAnonymously={p.messageShownAnonymously}
            />
          )}

          {/* 디지털 리워드 내려받기. 확정 메일에도 같은 주소가 나가지만, 메일을 지우거나 못
              받는 사람이 있어 이 화면에도 둔다 — 관리 토큰으로만 열리는 자리다.
              서버가 결제 살아 있는 건에만 내려보내므로 여기서 상태를 다시 보지 않는다. */}
          {refundRequested && isLive && (
            <Panel variant="outline" className="mt-6 text-sm">
              취소(환불)를 요청한 펀딩이라 음원 내려받기를 닫았습니다. 요청을 거두려면 010-4255-7893으로 연락 주세요.
            </Panel>
          )}
          {p.downloads.length > 0 && isLive && !refundRequested && (
            <div className="mt-6 space-y-2">
              {/* 링크가 아니라 폼이다 — 주소를 여는 것만으로는 기록이 남지 않아야, 메일
                  링크를 긁는 봇이 후원자의 청약철회권을 없애지 못한다. */}
              {p.downloads.map((d) => (
                <form key={d.key} method="post" action="/api/funding/download">
                  <input type="hidden" name="orderNo" value={p.orderNo} />
                  <input type="hidden" name="token" value={p.token} />
                  <input type="hidden" name="file" value={d.key} />
                  <Button type="submit" fullWidth>
                    {d.label} 내려받기
                  </Button>
                </form>
              ))}
              <p className="typo-card-meta">내려받기를 시작하면 청약철회가 제한됩니다(약관 제8조 2항).</p>
            </div>
          )}

          {/* 프로젝트 조회가 흔들리면 취소 가능 여부를 판정할 근거가 없다. 예전에는 그것을
              "마감"으로 읽어 모금 중인 프로젝트의 후원자에게 "펀딩 마감 후에는 온라인
              취소가 불가합니다"를 보여주고 내려받기 링크까지 없앴다. 사실이 아닌 안내
              대신 다시 열어 달라고 말한다. */}
          {p.lookupFailed ? (
            <Panel variant="outline" className="mt-6">
              <p className="typo-card-meta">지금은 후원 정보를 불러오지 못했습니다. 잠시 후 다시 열어 주세요. 문의: 010-4255-7893 · hello@studionol.co.kr</p>
            </Panel>
          ) : deposit ? (
            <Button className="mt-8" variant="weak" fullWidth onClick={withdraw} disabled={busy}>입금 전 신청 취소</Button>
          ) : status === 'paid' && !refundRequested && (p.canCancel
            ? (
              <div className="mt-6">
                {/* 계좌 입금 후원은 토스에 돌려줄 결제가 없다 — 환불받을 계좌를 먼저 받는다. */}
                {p.refundVia === 'bank_account' && accountFormOpen && (
                  <Panel variant="outline" className="mb-4">
                    <p className="text-base font-semibold text-gray-900 dark:text-white">환불받을 계좌</p>
                    <p className="typo-card-meta mt-1">계좌로 입금하신 펀딩이라 적어 주신 계좌로 직접 보내 드립니다. 계좌번호는 암호화해 보관합니다.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field id="refund-bank" label="은행" required>
                        <TextInput required maxLength={REFUND_ACCOUNT_LIMITS.bankName} value={refundAccount.bankName}
                          onChange={(e) => setRefundAccount({ ...refundAccount, bankName: e.target.value })} />
                      </Field>
                      <Field id="refund-holder" label="예금주" required>
                        <TextInput required maxLength={REFUND_ACCOUNT_LIMITS.accountHolder} value={refundAccount.accountHolder}
                          onChange={(e) => setRefundAccount({ ...refundAccount, accountHolder: e.target.value })} />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field id="refund-number" label="계좌번호" required>
                          <TextInput required inputMode="numeric" autoComplete="off" maxLength={REFUND_ACCOUNT_LIMITS.accountNumber} value={refundAccount.accountNumber}
                            onChange={(e) => setRefundAccount({ ...refundAccount, accountNumber: e.target.value })} />
                        </Field>
                      </div>
                    </div>
                  </Panel>
                )}
                <Button variant="weak" fullWidth onClick={cancel}
                  disabled={busy || (p.refundVia === 'bank_account' && accountFormOpen
                    && (!refundAccount.bankName.trim() || !refundAccount.accountNumber.trim() || !refundAccount.accountHolder.trim()))}>
                  {p.refundVia === 'bank_account'
                    ? (accountFormOpen ? '이 계좌로 환불 요청' : '펀딩 취소 (계좌로 전액 환불)')
                    : '펀딩 취소 (전액 환불)'}
                </Button>
              </div>
            )
            : (
              <Panel variant="outline" className="mt-6">
                <p className="typo-card-meta">{p.cancelBlockedReason} 문의: 010-4255-7893 · hello@studionol.co.kr</p>
              </Panel>
            ))}
          {confirmMessage && <Notice tone="success" className="mt-4">{confirmMessage}</Notice>}
          {error && <Notice tone="error" className="mt-4">{error}</Notice>}
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
      </PageShell>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
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
  // 조회 실패와 부재를 구분한다 — 실패를 마감으로 읽으면 모금 중인 후원자가 셀프 취소와
  // 내려받기를 잃는다(getFundingProjectOrFailure 주석).
  const { project, lookupFailed } = await getFundingProjectOrFailure(pl.projectSlug);
  // 화면과 서버(lib/funding/cancel.ts)가 같은 판정을 같은 인자로 부른다 — entrySource까지 필수다.
  const verdict = assessSelfCancel({ orderStatus: order.status, fundingEnded: project ? isPastFundingEnd(project, now) : true, fulfillmentStatus: pl.fulfillmentStatus, paymentMethod: pl.paymentMethod, entrySource: pl.entrySource, downloadedAt: pl.downloadedAt ?? null });
  const awaitingDeposit = canWithdrawBeforeDeposit({ orderStatus: order.status, paymentMethod: pl.paymentMethod, entrySource: pl.entrySource });
  /**
   * 내려받기 주소는 **결제가 살아 있을 때만** 내려보낸다. 환불·만료된 건에 링크를 남기면
   * 돈을 돌려받고도 리워드를 계속 받는 화면이 된다. 상태 판정은 셀프 취소와 같은 집합을
   * 쓴다(lib/funding/refundable.ts).
   */
  const lines = pledgeLines(pl);
  // 취소(환불)를 요청한 건도 내려보내지 않는다 — 계좌 입금 취소는 송금 전까지 paid로 남는다
  // (pages/api/funding/download.ts가 같은 조건으로 거부한다).
  const downloads = isLiveFundingOrderStatus(order.status) && pl.refundRequestedAt === null
    ? pledgeDownloads(project, activePledgeLines(lines).map((l) => l.rewardId))
    : [];
  const shipping = pl.shippingAddress1 ? `${pl.shippingName} · ${pl.shippingPhone} · (${pl.shippingPostcode}) ${pl.shippingAddress1} ${pl.shippingAddress2 ?? ''}` : null;
  return { props: {
    orderNo: order.orderNo, token, projectSlug: pl.projectSlug, projectTitle: project?.title ?? pl.projectSlug, rewardLabel: pledgeLinesLabel(lines),
    additionalAmount: pl.additionalAmount, totalAmount: order.totalAmount, status: order.status,
    paymentMethod: pl.paymentMethod, fulfillmentStatus: pl.fulfillmentStatus, shipping,
    // 조회 실패면 취소·내려받기를 내보내지 않는다. 판정 근거가 없는 것이지 마감이 아니다.
    canCancel: lookupFailed ? false : verdict.ok,
    refundVia: !lookupFailed && verdict.ok ? verdict.refundVia : null,
    // 계좌 안내는 프로젝트 조회와 무관하다 — 계좌·금액·기한은 전부 이 주문 행에 있다.
    deposit: awaitingDeposit
      ? { amount: order.totalAmount, deadline: pl.holdExpiresAt.toISOString(), customerName: order.customerName }
      : null,
    onlineBankTransfer: isOnlineBankTransfer(pl),
    cancelBlockedReason: lookupFailed || verdict.ok ? null : cancelBlockedMessage(
      verdict.code,
      activePledgeLines(lines).filter((l) => project?.rewards.find((r) => r.id === l.rewardId)?.requiresShipping).map((l) => l.rewardTitle),
    ),
    lookupFailed,
    refundRequested: pl.refundRequestedAt !== null,
    downloads: lookupFailed ? [] : downloads,
    displayNamePublic: pl.displayNamePublic,
    // 이름이 공개돼 있거나 앞으로 공개될 수 있는 상태에서만 바꾼다
    // (pages/api/funding/display-name.ts의 EDITABLE_STATUSES와 같은 판정).
    canEditDisplayName: ['pending', 'paid', 'partially_refunded'].includes(order.status),
    customerName: order.customerName,
    publicName: pl.publicName ?? null,
    supporterMessage: pl.supporterMessage ?? null,
    listingHidden: pl.listingHiddenAt != null,
    messageShownAnonymously: showsMessageAnonymously(pl.termsVersion),
  } };
});

// 디자인 판 — lib/designEdition.ts
FundingManagePage.designEdition = 'v2';
