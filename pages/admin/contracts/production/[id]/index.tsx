import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { AdminShell } from '../../../../../components/admin/AdminShell';
import { DANGER_GHOST_CLASS } from '../../../../../components/admin/adminDanger';
import { DangerActions } from '../../../../../components/admin/DangerActions';
import { copyToClipboard } from '../../../../../components/admin/contractActions';
import {
  deleteProductionContractRequest,
  downloadProductionPdf,
  mutateProductionContract,
  type ProductionActionResult,
} from '../../../../../components/admin/productionContractActions';
import ContractContent from '../../../../../components/contracts/ContractContent';
import ProductionProgressPanel from '../../../../../components/admin/ProductionProgressPanel';
import ProductionRefundAccountPanel, {
  type RefundAccountSummaryProps,
} from '../../../../../components/admin/ProductionRefundAccountPanel';
import { loadRefundAccountSummary } from '../../../../../lib/payments/refundAccount';
import { Button } from '../../../../../components/ui/Button';
import { getDb } from '../../../../../db/client';
import { authenticateAdminRequest } from '../../../../../lib/contracts/admin-auth';
import { formatCurrency } from '../../../../../lib/contracts/format';
import { formatAdminDate, formatAdminDateTime } from '../../../../../lib/admin/displayDate';
import { verifyStoredProductionContract, type ProductionFingerprintVerdict } from '../../../../../lib/contracts/production/audit';
import {
  serializeProductionContractForAdmin,
  type AdminSerializedProductionContract,
  type SerializedProductionSigner,
} from '../../../../../lib/contracts/production/serialize';
import {
  getProductionStatusLabel,
  hasSignedDocument,
  isProductionActionAllowed,
} from '../../../../../lib/contracts/production/status';
import { completeStalledProductionContract } from '../../../../../lib/contracts/production/finalize';
import { loadProgressContext } from '../../../../../lib/contracts/production/progress';
import { buildAdminProgressView, type AdminProgressView } from '../../../../../lib/contracts/production/progress-view';
import { ensureContractPaymentLink, listContractPaymentLinks } from '../../../../../lib/contracts/production/payment-link';
import { loadContractRefundPlan } from '../../../../../lib/contracts/production/refund-execute';
import { isOneSongKind, paymentPurposeWord, releaseTitle } from '../../../../../lib/contracts/production/terms';
import { recordAdminPrivacyAccess } from '../../../../../lib/privacy/accessLog';
import { ActionNotice } from '../../../../../components/admin/ActionNotice';
import { useAdminDialog } from '../../../../../components/admin/useAdminDialog';

interface ProductionContractDetailProps {
  contract: AdminSerializedProductionContract;
  fingerprint: ProductionFingerprintVerdict;
  /** 체결된 계약의 진행(장부). 체결 전에는 null. */
  progress: AdminProgressView | null;
  /** 해지된 계약의 환불 계좌 요약(은행·예금주만). 해지가 아니면 null. */
  refundAccount: RefundAccountSummaryProps | null;
  /** 계약 대금 결제 링크(payment-link.ts) — 최신순. 열린 것이 지금 받을 돈의 링크다. */
  paymentLinks: Array<{ url: string; purpose: 'deposit' | 'second' | 'balance'; amount: number; open: boolean; paid: boolean; createdAt: string }>;
}

export const getServerSideProps: GetServerSideProps<ProductionContractDetailProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') return { notFound: true };

  const load = () =>
    getDb()
      .query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id), with: { signers: true } })
      .catch((error: unknown) => {
        console.error('[admin/contracts/production/[id]] Failed to load contract:', error);
        return null;
      });
  let contract = await load();
  // 서명은 모두 끝났는데 성립에서 멈춘 계약(서명 직후 오류)은 여기서 마저 끝낸다.
  const recovered = contract
    ? await completeStalledProductionContract(contract).catch((error: unknown) => {
        console.error('[admin/contracts/production/[id]] Stalled finalize failed:', error);
        return false;
      })
    : false;
  if (recovered) contract = await load();

  // 개인정보를 여는 화면이다(처리방침 접속기록). 기록 실패가 화면을 막지 않는다.
  await recordAdminPrivacyAccess(context.req, auth.actor, 'production_contract_view', id, contract ? 'success' : 'not_found').catch(
    (error: unknown) => console.error('[privacy] 접속기록 호출 실패 — 화면은 계속됩니다', error),
  );

  if (!contract) return { notFound: true };

  const progress = hasSignedDocument(contract.status) && !contract.purgedAt ? await loadProgressContext(id) : null;

  let refundAccount: RefundAccountSummaryProps | null = null;
  if (progress && contract.status === 'terminated') {
    const summary = await loadRefundAccountSummary({ kind: 'production', orderNo: id });
    const plan = await loadContractRefundPlan(progress).catch(() => null);
    refundAccount = {
      refundable: progress.ledger.refund.refundable,
      card: plan ? plan.card.map((c) => ({ orderNo: c.orderNo, amount: c.amount, refunded: Math.min(c.amount, c.refunded) })) : [],
      bankTotal: plan ? plan.bankTotal : progress.ledger.refund.refundable,
      account:
        summary.status === 'present'
          ? { bankName: summary.bankName, accountHolder: summary.accountHolder, refundedAt: summary.refundedAt?.toISOString() ?? null }
          : null,
    };
  }

  // 진행 중 계약이면 지금 받을 돈의 링크를 맞춰 둔다(운영자가 바로 복사해 보낼 수 있게). 끝난 계약은 열린 링크를 닫는다.
  if (contract.status === 'signed' || contract.status === 'completed' || contract.status === 'terminated' || contract.status === 'cancelled') {
    await ensureContractPaymentLink(contract.id);
  }
  const paymentLinks = (await listContractPaymentLinks(contract.id)).map((link) => ({
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr'}/ko/pay/${link.slug}`,
    purpose: link.purpose,
    amount: Number(link.amount),
    open: link.closed_at === null,
    paid: Number(link.paid_orders) > 0,
    createdAt: new Date(Number(link.created_at) * 1000).toISOString(),
  }));

  return {
    props: {
      paymentLinks,
      contract: serializeProductionContractForAdmin(contract),
      fingerprint: verifyStoredProductionContract(contract),
      progress: progress ? buildAdminProgressView(progress.terms, progress.ledger, progress.events, contract.status === 'signed') : null,
      refundAccount,
    },
  };
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-200 text-gray-700',
  terminated: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

const ROLE_LABEL: Record<SerializedProductionSigner['role'], string> = {
  operator: '스튜디오 (운영자)',
  client: '의뢰인',
  guardian: '법정대리인',
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

const FingerprintLine = ({ verdict }: { verdict: ProductionFingerprintVerdict }) => {
  switch (verdict.kind) {
    case 'unsigned':
      return <span className="text-gray-400">아직 체결되지 않았습니다</span>;
    case 'purged':
      return <span className="text-gray-500">개인정보 파기로 대조하지 않습니다 ({verdict.short})</span>;
    case 'match':
      return <span className="text-green-700">일치 — 서명 당시 문서 그대로입니다 ({verdict.short})</span>;
    case 'mismatch':
      return <strong className="text-red-700">불일치 — 서명 뒤 값이 바뀌었을 수 있습니다. 즉시 확인하세요 ({verdict.short})</strong>;
    default:
      return <span className="text-amber-700">대조할 수 없습니다 ({verdict.reason})</span>;
  }
};

export default function ProductionContractDetailPage({ contract, fingerprint, progress, refundAccount, paymentLinks }: ProductionContractDetailProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useAdminDialog();
  const [notice, setNotice] = useState<string | null>(null);
  const { terms } = contract;
  const allowed = (action: Parameters<typeof isProductionActionAllowed>[1]) =>
    isProductionActionAllowed(contract.status, action);

  /** 요청 → 결과 안내 → 새로고침. 실패해도 새로고침한다 — 거절 사유는 대개 화면이 낡았다는 뜻이다. */
  const run = async (task: () => Promise<ProductionActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setNotice(null);
    const result = await task();
    setBusy(false);
    setNotice(result.ok ? (result.message ?? null) : (result.message ?? '요청을 처리하지 못했습니다.'));
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleComplete = () => {
    // 완료일은 기록된 최종 인도일로 정해진다(개인정보 3년 보관의 기산점, 제13조).
    void run(
      () => mutateProductionContract(contract.id, 'complete'),
      '완료 처리할까요? 완료일은 최종 파일을 인도한 날로 기록되고, 그날부터 3년 뒤 개인정보를 파기합니다.',
    );
  };

  const handleTerminate = async () => {
    // 누구의 사정인지가 정산 조항을 가른다 — 스튜디오 사정(제10조 4항)이면 추가 비용·초과 수정 요금도 돌려준다.
    const values = await ask({
      title: '해지 처리',
      description: '해지한 뒤에는 되돌릴 수 없습니다. 의뢰인에게 해지·환불 안내 메일이 나갑니다.',
      fields: [
        {
          name: 'cause',
          label: '누구의 사정으로 해지하나요?',
          type: 'select',
          defaultValue: '',
          options: [
            { value: '', label: '고르기' },
            { value: 'client', label: '의뢰인 사정 (제10조 3항)' },
            { value: 'client_default', label: '의뢰인 무응답·대금 지체, 통지 후 해지 (제10조 5항)' },
            { value: 'studio', label: '스튜디오 사정 (제10조 4항, 제12조 2항 지연 포함)' },
          ],
          required: '해지 사유 구분을 골라 주세요.',
        },
        {
          name: 'reason',
          label: '해지 사유',
          type: 'textarea',
          placeholder: '예: 편곡 1차 시안 전달 후 의뢰인 요청으로 해지 / 대금 14일 지체로 통지 후 해지',
          required: '해지 사유를 입력해 주세요.',
        },
        {
          name: 'closedOn',
          label: '해지한 날',
          type: 'date',
          defaultValue: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
          hint: '보관 기간(3년)의 기산점이라 실제 날짜를 넣어 주세요. 비우면 오늘.',
        },
      ],
      confirmLabel: '해지 처리',
      tone: 'danger',
    });
    if (values === null) return;
    const cause = values.cause as 'client' | 'client_default' | 'studio';
    void run(() => mutateProductionContract(contract.id, 'terminate', { cause, reason: values.reason.trim(), closedOn: values.closedOn.trim() }));
  };

  const handleDelete = async () => {
    if (!window.confirm('이 계약을 삭제할까요? 되돌릴 수 없습니다.')) return;
    setBusy(true);
    const result = await deleteProductionContractRequest(contract.id);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message ?? '삭제하지 못했습니다.');
      return;
    }
    await router.replace('/admin/contracts/production');
  };

  return (
    <>
      <Head>
        <title>{`${contract.clientName || '의뢰인 미정'}님 제작 계약 | Studio NOL`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell
        title="제작 계약 상세"
        description={`${contract.clientName ? `${contract.clientName}님` : '의뢰인 정보는 서명할 때 받아요(카톡 링크)'} · ${releaseTitle(contract.kind, terms)}`}
        backHref="/admin/contracts/production"
        backLabel="제작 계약 목록"
      >
        <ActionNotice message={notice} />

        {/* 메일·PDF는 응답 뒤에 처리돼 실패가 화면에 흔적을 남기지 않는다. 남겨 둔 사유를 띄운다. */}
        {contract.notificationError && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
            <strong className="block mb-1">알림 처리에 문제가 있었습니다</strong>
            {contract.notificationError}
            <span className="block mt-2 text-amber-700">
              {contract.status === 'sent' || contract.status === 'expired'
                ? '의뢰인이 메일을 받지 못했을 수 있습니다. 재발송하거나 서명 링크를 직접 전달해 주세요.'
                : contract.status === 'terminated'
                  ? '의뢰인이 해지 안내(환불액·환불 계좌 입력)를 받지 못했을 수 있습니다. 아래 “해지 안내 재발송”을 눌러 주세요.'
                  : '의뢰인이 체결 메일을 받지 못했을 수 있습니다. 아래 “완료 메일 재발송”을 눌러 주세요.'}
            </span>
          </div>
        )}

        {contract.purgedAt && (
          <div className="mb-4 p-4 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm">
            <strong className="block mb-1">보관 기간이 지나 개인정보가 파기된 계약입니다</strong>
            {formatAdminDate(contract.purgedAt)}에 의뢰인 정보·본문·서명 기록을 지웠습니다. 금액·날짜만 운영 기록으로 남아 있습니다.
          </div>
        )}

        {contract.status === 'signed' && !contract.pdfUrl && !contract.purgedAt && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
            <strong className="block mb-1">서명본 PDF가 보관되지 않았습니다</strong>
            아래 “PDF 다운로드”를 누르면 계약 내용으로 다시 만들어 받을 수 있습니다.
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 md:p-8 border-b border-gray-200">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[contract.status]}`}>
                {getProductionStatusLabel(contract.status)}
              </span>
              <span className="text-gray-400 text-xs font-mono">{contract.id}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">의뢰인</h2>
                <dl className="space-y-2 text-sm">
                  <Row label="성명" value={contract.clientName || '서명할 때 의뢰인이 입력'} />
                  <Row label="활동명" value={contract.clientStageName || '-'} />
                  <Row label="생년월일" value={contract.clientBirthdate || '-'} />
                  <Row label="이메일" value={contract.clientEmail || '서명할 때 의뢰인이 입력'} />
                  <Row label="연락처" value={contract.clientPhone || '서명할 때 의뢰인이 입력'} />
                  <Row label="주소" value={contract.clientAddress || '-'} />
                </dl>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">계약 조건</h2>
                <dl className="space-y-2 text-sm">
                  <Row label={isOneSongKind(contract.kind) ? '본 곡' : '음반'} value={releaseTitle(contract.kind, terms)} />
                  <Row label="계약금액" value={`${formatCurrency(terms.amount.total)}원`} />
                  {terms.amount.balance === 0 && terms.amount.second === 0 ? (
                    <Row label="대금 지급" value={`일시불 (체결 후 ${terms.amount.depositDueDays}일)`} />
                  ) : (
                    <>
                      <Row label="계약금" value={`${formatCurrency(terms.amount.deposit)}원 (체결 후 ${terms.amount.depositDueDays}일)`} />
                      {terms.amount.second > 0 && (
                        <Row label="중간금" value={`${formatCurrency(terms.amount.second)}원 (편곡 승인 후 ${terms.amount.secondDueDays}일)`} />
                      )}
                      <Row label="잔금" value={`${formatCurrency(terms.amount.balance)}원 (최종 승인 후 ${terms.amount.balanceDueDays}일)`} />
                    </>
                  )}
                  {terms.refundPolicy && (
                    <Row
                      label="해지 환불"
                      value={`받은 금액 × 단계 비율 (착수 전 100% · ${terms.refundPolicy.stages.map((s) => `${Math.round(s.ratio * 100)}%`).join(' · ')})`}
                    />
                  )}
                  <Row
                    label="납품 기한"
                    value={`${terms.firstDeliveryBusinessDays ? `믹싱 1차 ${terms.firstDeliveryBusinessDays}영업일 · ` : ''}최종 ${terms.workWeeks}주 이내`}
                  />
                  <Row
                    label="무료 수정"
                    value={`${terms.scope.arrangementTracks > 0 ? `편곡 ${terms.revisions.arrangement} · ` : ''}믹싱 ${terms.revisions.mixing} · 마스터링 ${terms.revisions.mastering}회`}
                  />
                </dl>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <dl className="space-y-2">
                <Row label="작성일" value={formatAdminDateTime(contract.createdAt)} />
                <Row label="발송일" value={formatAdminDateTime(contract.sentAt)} />
                <Row
                  label="링크 만료"
                  value={contract.status === 'sent' || contract.status === 'expired' ? `${formatAdminDateTime(contract.expiresAt)}${contract.status === 'expired' ? ' (만료됨 — 재발송하면 새 링크)' : ''}` : '-'}
                />
              </dl>
              <dl className="space-y-2">
                <Row label="체결일" value={formatAdminDateTime(contract.signedAt)} />
                {contract.completedAt && <Row label="완료일" value={formatAdminDate(contract.completedAt)} />}
                {contract.terminatedAt && <Row label="해지일" value={formatAdminDate(contract.terminatedAt)} />}
                {contract.terminationReason && <Row label="해지 사유" value={contract.terminationReason} />}
              </dl>
            </div>
          </div>

          {/* 감사추적 — "서명한 적 없다"는 주장에 내놓을 기록. 서명자마다 열람·본인 확인·서명 정황을 보인다. */}
          <div className="p-4 md:p-8 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">서명 기록</h2>
            <div className="space-y-4">
              {contract.signers.map((signer) => (
                <div key={signer.id} className="flex flex-wrap items-start gap-4 p-4 bg-gray-50 rounded-lg text-sm">
                  {signer.signatureData && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signer.signatureData} alt="서명" className="max-h-20 border border-gray-200 rounded-lg bg-white" />
                  )}
                  <dl className="space-y-0.5 text-gray-600">
                    <dt className="font-semibold text-gray-900">{ROLE_LABEL[signer.role]}</dt>
                    <dd>
                      서명자: {signer.name || '(서명할 때 의뢰인이 입력)'}
                      {signer.relation ? ` (${signer.relation})` : ''}
                      {signer.phone ? ` · ${signer.phone}` : ''}
                    </dd>
                    {signer.adminActor && <dd>관리자 계정: {signer.adminActor} (발송 = 운영자 서명, 직인)</dd>}
                    <dd>서명: {signer.status === 'signed' ? formatAdminDateTime(signer.signedAt) : '대기'}</dd>
                    <dd>IP: {signer.ipAddress || '-'}</dd>
                    {signer.role !== 'operator' && (
                      <>
                        <dd>
                          열람: {signer.firstViewedAt ? `처음 ${formatAdminDateTime(signer.firstViewedAt)} · ${signer.viewCount}회` : '기록 없음'}
                          {signer.firstViewedIp ? ` (처음 연 IP ${signer.firstViewedIp})` : ''}
                        </dd>
                        <dd>
                          본인 확인:{' '}
                          {signer.identityVerifiedAt
                            ? `연락처 뒷자리 대조 완료 (${formatAdminDateTime(signer.identityVerifiedAt)})`
                            : signer.status === 'signed' && signer.role === 'client'
                              ? '연락처 대조 없음 — 링크 계약(카톡 상대와 이름·연락처가 맞는지 확인해 주세요)'
                              : '기록 없음'}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm">
              문서 지문: <FingerprintLine verdict={fingerprint} />
            </p>
            <p className="mt-1 text-xs text-gray-400">
              열람 기록은 “이 링크가 이 시각에 이 IP에서 열렸다”로만 읽습니다 — 메일 보안 스캐너가 먼저 열 수 있습니다.
            </p>
          </div>

          <details className="p-4 md:p-8">
            <summary className="text-lg font-bold text-gray-900 dark:text-gray-900 cursor-pointer">계약서 본문</summary>
            <div className="mt-4">
              <ContractContent content={contract.content} size="sm" />
            </div>
          </details>
        </div>

        {refundAccount && <ProductionRefundAccountPanel contractId={contract.id} summary={refundAccount} />}

        {paymentLinks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-2">결제 링크</h2>
            <p className="text-sm text-gray-600 mb-4">
              카드·간편결제·계좌 입금으로 받는 계약 대금 링크예요. 결제되면 진행 기록에 입금이 자동으로 남고 링크가 닫혀요. 계좌로 직접 받으면
              아래 진행 기록에서 “입금 확인”을 남기면 열린 링크가 남은 금액에 맞게 바뀌어요.
            </p>
            <ul className="space-y-2 text-sm">
              {paymentLinks.map((link) => (
                <li key={link.url} className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3">
                  <span className="font-semibold text-gray-900">{link.purpose === 'deposit' ? '대금·계약금' : paymentPurposeWord(link.purpose, terms)}</span>
                  <span className="tabular-nums">{formatCurrency(link.amount)}원</span>
                  <span className={link.paid ? 'text-green-700' : link.open ? 'text-blue-700' : 'text-gray-500'}>
                    {link.paid ? '결제됨' : link.open ? '열림 — 결제 대기' : '닫힘'}
                  </span>
                  <span className="text-gray-500">{formatAdminDateTime(link.createdAt)}</span>
                  {link.open && (
                    <Button
                      light
                      size="sm"
                      variant="secondary"
                      onClick={async () => setNotice((await copyToClipboard(link.url)) ? '결제 링크를 복사했습니다.' : '링크 복사에 실패했습니다.')}
                    >
                      결제 링크 복사
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {progress && (
          <ProductionProgressPanel
            contractId={contract.id}
            view={progress}
            editable={contract.status === 'signed'}
            voidable={contract.status === 'signed' || contract.status === 'terminated'}
          />
        )}

        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">작업</h2>
          <div className="flex flex-wrap gap-3">
            {allowed('send') && (
              <Button
                light
                disabled={busy}
                onClick={() =>
                  run(
                    () => mutateProductionContract(contract.id, 'send'),
                    (contract.clientEmail
                      ? `스튜디오 대표로 이 계약서에 서명하고 ${[contract.clientEmail, contract.signers.find((s) => s.role === 'guardian')?.email]
                          .filter(Boolean)
                          .join(', ')} 주소로 서명 요청을 보냅니다.\n`
                      : '스튜디오 대표로 이 계약서에 서명하고 서명 링크를 만듭니다. 메일은 나가지 않아요 — "서명 링크 복사"로 카카오톡에 보내 주세요.\n') +
                      '발송한 뒤에는 내용을 고칠 수 없습니다. 계속할까요?',
                  )
                }
              >
                {busy ? '처리 중...' : '서명하고 발송'}
              </Button>
            )}

            {contract.status === 'sent' && contract.signUrl && (
              <Button
                light
                variant="secondary"
                onClick={async () => setNotice((await copyToClipboard(contract.signUrl)) ? '서명 링크를 복사했습니다.' : '링크 복사에 실패했습니다.')}
              >
                서명 링크 복사
              </Button>
            )}

            {contract.status === 'sent' && contract.guardianSignUrl && (
              <Button
                light
                variant="secondary"
                onClick={async () =>
                  setNotice((await copyToClipboard(contract.guardianSignUrl)) ? '법정대리인 서명 링크를 복사했습니다.' : '링크 복사에 실패했습니다.')
                }
              >
                법정대리인 서명 링크 복사
              </Button>
            )}

            {contract.progressUrl && (
              <Button
                light
                variant="secondary"
                onClick={async () =>
                  setNotice((await copyToClipboard(contract.progressUrl)) ? '진행 페이지 링크를 복사했습니다.' : '링크 복사에 실패했습니다.')
                }
              >
                진행 페이지 링크 복사
              </Button>
            )}

            {allowed('resend') && (
              <Button
                light
                variant={contract.status === 'sent' ? 'weak' : 'solid'}
                disabled={busy}
                onClick={() =>
                  run(
                    () => mutateProductionContract(contract.id, 'resend'),
                    contract.clientEmail
                      ? '재발송하면 기존 서명 링크는 즉시 무효가 됩니다. 계속할까요?'
                      : '재발송하면 기존 서명 링크는 즉시 무효가 됩니다. 메일은 나가지 않으니 새 링크를 "서명 링크 복사"로 카카오톡에 다시 보내야 해요. 계속할까요?',
                  )
                }
              >
                재발송
              </Button>
            )}

            {allowed('update') && (
              <Button asChild light variant="weak">
                <Link href={`/admin/contracts/production/${contract.id}/edit`}>수정</Link>
              </Button>
            )}

            {hasSignedDocument(contract.status) && !contract.purgedAt && (
              <Button light disabled={busy} onClick={() => run(() => downloadProductionPdf(contract.id, contract.clientName))}>
                PDF 다운로드
              </Button>
            )}

            {allowed('resend-signed') && !contract.purgedAt && (
                <Button
                  light
                  variant="weak"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => mutateProductionContract(contract.id, 'resend-signed'),
                      '체결 메일과 PDF를 의뢰인에게 다시 보냅니다. 계약 내용과 링크는 그대로입니다. 계속할까요?',
                    )
                  }
                >
                  완료 메일 재발송
                </Button>
            )}
            {allowed('resend-termination') && !contract.purgedAt && (
              <Button
                light
                variant="weak"
                disabled={busy}
                onClick={() =>
                  run(
                    () => mutateProductionContract(contract.id, 'resend-termination'),
                    '해지 안내(환불액·환불 계좌 입력 안내)를 의뢰인에게 다시 보냅니다. 계속할까요?',
                  )
                }
              >
                해지 안내 재발송
              </Button>
            )}

            {allowed('complete') && (
              <Button light variant="weak" disabled={busy} onClick={handleComplete}>
                완료 처리 (최종 인도)
              </Button>
            )}

            <Button asChild light variant="weak">
              <Link href={`/admin/contracts/production/new?from=${contract.id}`}>복제해서 새 계약</Link>
            </Button>

            {/* 되돌릴 수 없는 동작은 줄 끝에 모은다(DangerActions). */}
            <DangerActions>
              {allowed('cancel') && (
                <Button
                  light
                  variant="ghost"
                  className={DANGER_GHOST_CLASS}
                  disabled={busy}
                  onClick={() => run(() => mutateProductionContract(contract.id, 'cancel'), '이 계약을 취소할까요? 서명 링크가 무효가 됩니다.')}
                >
                  계약 취소
                </Button>
              )}

              {allowed('terminate') && (
                <Button light variant="ghost" className={DANGER_GHOST_CLASS} disabled={busy} onClick={handleTerminate}>
                  해지 처리
                </Button>
              )}

              {allowed('delete') && (
                <Button light variant="ghost" className={DANGER_GHOST_CLASS} disabled={busy} onClick={handleDelete}>
                  삭제
                </Button>
              )}
            </DangerActions>
          </div>
        </div>
        {dialog}
      </AdminShell>
    </>
  );
}
