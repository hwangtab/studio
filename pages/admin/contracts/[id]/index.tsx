import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AuditTrail from '../../../../components/contracts/AuditTrail';
import ContractContent from '../../../../components/contracts/ContractContent';
import {
  copyToClipboard,
  deleteContract,
  downloadContractPdf,
  mutateContract,
} from '../../../../components/admin/contractActions';
import { createSubscription as createSubscriptionRequest } from '../../../../components/admin/subscriptionActions';
import { Button } from '../../../../components/ui/Button';
import { getDb } from '../../../../db/client';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import {
  serializeAttachment,
  serializeClause,
  serializeContractForAdmin,
  serializeSignature,
  type AdminSerializedContract,
  type SerializedAttachment,
  type SerializedClause,
  type SerializedSignature,
} from '../../../../lib/contracts/serialize';
import { formatCurrency, formatDate, formatDateTime } from '../../../../lib/contracts/format';
import { getStatusLabel, isActionAllowed, needsTermination } from '../../../../lib/contracts/status';
import { resolveRulesContent } from '../../../../lib/contracts/template';
import { buildAuditTrail, serializeAuditTrail, type SerializedAuditTrail } from '../../../../lib/contracts/audit-trail';

interface AdminContractDetailPageProps {
  contract: AdminSerializedContract;
  signatures: SerializedSignature[];
  clauses: SerializedClause[];
  attachments: SerializedAttachment[];
  /** 계약에 붙은 이용수칙 사본. 첨부 목록은 제목만 보여 주므로 본문은 따로 싣는다. */
  rulesContent: string;
  auditTrail: SerializedAuditTrail;
  /** 이 계약으로 만든 구독이 있으면 그 id — 있으면 새로 만들지 않고 상세로 안내한다. */
  subscriptionId: string | null;
}

export const getServerSideProps: GetServerSideProps<AdminContractDetailPageProps> = async (
  context,
) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { id } = context.query;
  if (typeof id !== 'string') {
    return { notFound: true };
  }

  const contract = await getDb().query.contracts
    .findFirst({
      where: (contracts, { eq }) => eq(contracts.id, id),
      with: { signatures: true, contractClauses: true, contractAttachments: true },
    })
    .catch((error: unknown) => {
      console.error('[admin/contracts/[id]] Failed to load contract:', error);
      return null;
    });

  if (!contract) {
    return { notFound: true };
  }

  // 최신 구독 하나만 있으면 충분하다(연습실 구독은 계약당 하나가 정상 운영 형태 —
  // lib/billing/service.ts의 already_exists 가드가 진행 중인 상태에서 중복을 막는다).
  const subscription = await getDb()
    .query.subscriptions.findFirst({
      where: (t, { eq }) => eq(t.contractId, id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    })
    .catch(() => null);

  return {
    props: {
      contract: serializeContractForAdmin(contract),
      signatures: contract.signatures.map(serializeSignature),
      clauses: contract.contractClauses.map(serializeClause),
      attachments: contract.contractAttachments.map(serializeAttachment),
      rulesContent: resolveRulesContent(contract.contractAttachments),
      auditTrail: serializeAuditTrail(buildAuditTrail(contract)),
      subscriptionId: subscription?.id ?? null,
    },
  };
};



const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
  terminated: 'bg-gray-200 text-gray-600',
};

const DescriptionRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

export default function AdminContractDetailPage({
  contract,
  signatures,
  clauses,
  attachments,
  rulesContent,
  auditTrail,
  subscriptionId,
}: AdminContractDetailPageProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [subscriptionSetupUrl, setSubscriptionSetupUrl] = useState<string | null>(null);

  const customerSignature = signatures.find((s) => s.signerRole === 'customer');

  const run = async (task: () => Promise<{ ok: boolean; message?: string }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;

    setBusy(true);
    setNotice(null);
    const result = await task();
    setBusy(false);

    if (!result.ok) {
      setNotice(result.message ?? '요청을 처리하지 못했습니다.');
    }
    // 실패해도 새로고침한다 — 거절 사유는 대개 화면이 낡았다는 뜻이다.
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const handleCopyLink = async () => {
    const copied = await copyToClipboard(contract.signUrl);
    setNotice(copied ? '서명 링크를 복사했습니다.' : '링크 복사에 실패했습니다.');
  };

  /**
   * 이용 종료 처리.
   *
   * 사유를 반드시 받는다. 나중에 이 방이 왜, 언제 비었는지를 설명하는 유일한 기록이고,
   * 위약금(제5조 ③)이 걸린 중도 퇴실인지 정상 만료인지가 분쟁의 쟁점이 된다.
   */
  const handleTerminate = async () => {
    const reason = window.prompt(
      '이용 종료 사유를 적어 주세요. 계약서는 그대로 보관되고, 이 호실로 새 계약을 만들 수 있게 됩니다.\n\n' +
        '예: 기간 만료 후 종료 / 중도 퇴실(위약금 납부) / 이용료 연체로 해지',
    );
    if (reason === null) return;

    if (reason.trim() === '') {
      setNotice('종료 사유를 입력해 주세요.');
      return;
    }

    await run(() => mutateContract(contract.id, 'terminate', { reason: reason.trim() }));
  };

  const handleDelete = async () => {
    if (!window.confirm('이 계약을 삭제할까요? 되돌릴 수 없습니다.')) return;

    setBusy(true);
    const result = await deleteContract(contract.id);
    setBusy(false);

    if (!result.ok) {
      setNotice(result.message ?? '삭제하지 못했습니다.');
      return;
    }
    await router.replace('/admin/contracts');
  };

  return (
    <>
      <Head>
        <title>{contract.customerName}님 계약 상세 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">계약 상세</h1>
            <Link href="/admin/contracts" passHref>
              <Button variant="outline">목록으로</Button>
            </Link>
          </div>

          {notice && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">{notice}</div>
          )}

          {subscriptionSetupUrl && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-900 rounded-lg text-sm">
              <strong className="block mb-2">고객에게 보낼 카드 등록 링크</strong>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate bg-white border border-green-200 rounded px-2 py-1 text-xs">
                  {subscriptionSetupUrl}
                </code>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const copied = await copyToClipboard(subscriptionSetupUrl);
                    setNotice(copied ? '링크를 복사했습니다.' : '링크 복사에 실패했습니다.');
                  }}
                >
                  복사
                </Button>
              </div>
              <p className="mt-2 text-green-700">카톡으로 보내는 것이 주 채널입니다.</p>
            </div>
          )}

          {/* 메일·PDF는 응답 이후에 처리돼 실패해도 화면에 흔적이 없었다. 남겨 둔 사유를
              띄워야 관리자가 재발송하거나 링크를 직접 전달할 수 있다. */}
          {contract.notificationError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              <strong className="block mb-1">알림 처리에 문제가 있었습니다</strong>
              {contract.notificationError}
              {/* 안내는 화면에 실제로 있는 버튼만 가리켜야 한다. signed 상태에는 '재발송'도
                  '서명 링크 복사'도 렌더되지 않는데 그걸 누르라고 적혀 있었다. */}
              <span className="block mt-2 text-amber-700">
                {contract.status === 'signed'
                  ? '고객이 서명 완료 메일을 받지 못했을 수 있습니다. 아래 "완료 메일 재발송"을 눌러 주세요.'
                  : '고객이 메일을 받지 못했을 수 있습니다. 재발송하거나 서명 링크를 직접 전달해 주세요.'}
              </span>
            </div>
          )}

          {/* 파기된 계약은 상태가 signed로 남지만 이름·본문·서명이 모두 비어 있다.
              그 사실을 먼저 알리고, PDF 재발급 안내는 띄우지 않는다. */}
          {contract.purgedAt && (
            <div className="mb-4 p-4 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm">
              <strong className="block mb-1">보관 기간이 지나 개인정보가 파기된 계약입니다</strong>
              {formatDate(contract.purgedAt)}에 제목·이름·연락처·계약 본문·서명 기록을 지웠습니다.
              계약 기간과 금액만 운영 기록으로 남아 있으며, 계약서를 다시 발급할 수 없습니다.
            </div>
          )}

          {/* 기간이 끝났는데 종료 처리가 없으면 그 호실로 새 계약을 만들 수 없다.
              제3조의 자동 갱신 때문에 시스템이 임의로 끝내지 않고 운영자에게 확인을 받는다. */}
          {needsTermination(contract) && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-sm">
              <strong className="block mb-1">이용 기간이 지났습니다</strong>
              계약서상 종료일({formatDate(contract.endDate)})이 지났습니다. 갱신해서 계속
              이용 중이면 그대로 두시고, 이용이 끝났다면 아래 “이용 종료 처리”를 눌러 주세요.
              <span className="block mt-2 text-blue-700">
                종료 처리를 해야 {contract.roomNumber}호로 새 계약을 만들 수 있습니다.
              </span>
            </div>
          )}

          {contract.status === 'terminated' && (
            <div className="mb-4 p-4 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-sm">
              <strong className="block mb-1">이용이 종료된 계약입니다</strong>
              {formatDate(contract.terminatedAt)}에 종료 처리했습니다.
              {contract.terminationReason && (
                <span className="block mt-1">사유: {contract.terminationReason}</span>
              )}
              <span className="block mt-2 text-gray-500">
                계약서와 서명 기록은 그대로 보관됩니다.
              </span>
            </div>
          )}

          {contract.status === 'signed' && !contract.pdfUrl && !contract.purgedAt && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
              <strong className="block mb-1">서명본 PDF가 보관되지 않았습니다</strong>
              아래 “PDF 다운로드”를 누르면 계약 내용으로 다시 만들어 받을 수 있습니다.
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="p-6 md:p-8 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[contract.status]}`}
                >
                  {getStatusLabel(contract.status)}
                </span>
                <span className="text-gray-400 text-xs font-mono">{contract.id}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">이용자 정보</h2>
                  <dl className="space-y-2 text-sm">
                    <DescriptionRow label="성명" value={contract.customerName} />
                    <DescriptionRow label="생년월일" value={contract.customerBirthdate || '-'} />
                    <DescriptionRow label="이메일" value={contract.customerEmail} />
                    <DescriptionRow label="전화번호" value={contract.customerPhone} />
                    <DescriptionRow label="주소" value={contract.customerAddress || '-'} />
                  </dl>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">계약 정보</h2>
                  <dl className="space-y-2 text-sm">
                    <DescriptionRow
                      label="호실"
                      value={`${contract.roomNumber}호 (${contract.roomArea})`}
                    />
                    <DescriptionRow
                      label="계약 기간"
                      value={`${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`}
                    />
                    <DescriptionRow
                      label="월 이용료"
                      value={`${formatCurrency(contract.monthlyRent)}원`}
                    />
                    <DescriptionRow
                      label="보증금"
                      value={`${formatCurrency(contract.depositAmount)}원`}
                    />
                    <DescriptionRow label="납부일" value={`매월 ${contract.paymentDay}일`} />
                  </dl>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <dl className="space-y-2">
                  <DescriptionRow label="작성일" value={formatDateTime(contract.createdAt)} />
                  <DescriptionRow label="발송일" value={formatDateTime(contract.sentAt)} />
                </dl>
                <dl className="space-y-2">
                  <DescriptionRow
                    label="링크 만료"
                    value={contract.status === 'sent' ? formatDateTime(contract.expiresAt) : '-'}
                  />
                  <DescriptionRow label="서명일" value={formatDateTime(contract.signedAt)} />
                </dl>
              </div>
            </div>

            <div className="p-6 md:p-8 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">동의 항목</h2>
              <div className="space-y-2">
                {clauses.map((clause) => (
                  <div
                    key={clause.id}
                    className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <span>
                      <strong>{clause.clauseNumber}</strong> {clause.title}
                    </span>
                    <span
                      className={`shrink-0 font-medium ${clause.agreedAt ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      {clause.agreedAt ? `✓ ${formatDateTime(clause.agreedAt)}` : '미동의'}
                    </span>
                  </div>
                ))}
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg text-sm"
                  >
                    <span>「{attachment.title}」</span>
                    <span
                      className={`shrink-0 font-medium ${attachment.agreedAt ? 'text-green-600' : 'text-gray-400'}`}
                    >
                      {attachment.agreedAt ? `✓ ${formatDateTime(attachment.agreedAt)}` : '미동의'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 md:p-8 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">서명 기록</h2>
              {customerSignature?.status === 'signed' ? (
                <div className="flex flex-wrap items-center gap-4">
                  {customerSignature.signatureData && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={customerSignature.signatureData}
                      alt="서명"
                      className="max-h-20 border border-gray-200 rounded-lg bg-white"
                    />
                  )}
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p>서명자: {customerSignature.signerName}</p>
                    <p>이메일: {customerSignature.signerEmail}</p>
                    <p>일시: {formatDateTime(customerSignature.signedAt)}</p>
                    <p>IP: {customerSignature.ipAddress || '-'}</p>
                    {/* 분쟁 시 쓰이는 증거이므로 관리자가 바로 확인할 수 있어야 한다. */}
                    <p>
                      본인 확인:{' '}
                      {contract.identityVerifiedAt ? (
                        <span className="text-green-600">
                          연락처 뒷자리 대조 완료 ({formatDateTime(contract.identityVerifiedAt)})
                        </span>
                      ) : (
                        <span className="text-gray-400">기록 없음</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">아직 서명하지 않았습니다.</p>
              )}
            </div>

            <AuditTrail trail={auditTrail} />

            <div className="p-6 md:p-8 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">계약서 본문</h2>
              <ContractContent content={contract.content} size="sm" />
            </div>

            {/* 계약 시점에 떠 둔 이용수칙 사본. 원본 파일이 바뀌어도 이 계약에 적용되는 것은
                이 내용이므로, 분쟁이 생기면 여기를 봐야 한다. */}
            {rulesContent && (
              <details className="p-6 md:p-8">
                <summary className="text-lg font-bold text-gray-900 cursor-pointer">
                  첨부: 공동생활 이용수칙 (계약 시점 사본)
                </summary>
                <div className="mt-4">
                  <ContractContent content={rulesContent} size="sm" />
                </div>
              </details>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">작업</h2>
            <div className="flex flex-wrap gap-3">
              {isActionAllowed(contract.status, 'send') && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => mutateContract(contract.id, 'send'),
                      `${contract.customerEmail} 주소로 서명 요청 메일을 보냅니다. 계속할까요?`,
                    )
                  }
                >
                  {busy ? '처리 중...' : '고객에게 발송'}
                </Button>
              )}

              {contract.status === 'sent' && (
                <Button variant="secondary" onClick={handleCopyLink}>
                  서명 링크 복사
                </Button>
              )}

              {isActionAllowed(contract.status, 'resend') && (
                <Button
                  variant={contract.status === 'sent' ? 'outline' : 'solid'}
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => mutateContract(contract.id, 'resend'),
                      '재발송하면 기존 서명 링크는 즉시 무효가 됩니다. 계속할까요?',
                    )
                  }
                >
                  재발송
                </Button>
              )}

              {isActionAllowed(contract.status, 'resend-signed') && !contract.purgedAt && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => mutateContract(contract.id, 'resend-signed'),
                      '서명 완료 메일과 PDF를 고객에게 다시 보냅니다. 계약 내용과 서명 링크는 그대로입니다. 계속할까요?',
                    )
                  }
                >
                  완료 메일 재발송
                </Button>
              )}

              {contract.status === 'signed' && (
                subscriptionId ? (
                  <Link href={`/admin/subscriptions/${subscriptionId}`} passHref>
                    <Button variant="outline">정기결제 구독 보기</Button>
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const result = await createSubscriptionRequest({
                          kind: 'practice-room',
                          contractId: contract.id,
                          customerName: contract.customerName,
                          customerPhone: contract.customerPhone,
                          customerEmail: contract.customerEmail,
                          billingDay: contract.paymentDay,
                        });
                        if (result.ok && result.setupUrl) {
                          setSubscriptionSetupUrl(result.setupUrl);
                        }
                        return result;
                      }, '이 계약으로 정기결제 구독을 만들까요? 고객에게 카드 등록 안내 메일이 발송됩니다.')
                    }
                  >
                    정기결제 링크 만들기
                  </Button>
                )
              )}

              {isActionAllowed(contract.status, 'update') && (
                <Link href={`/admin/contracts/${contract.id}/edit`} passHref>
                  <Button variant="outline">수정</Button>
                </Link>
              )}

              {contract.status === 'signed' && !contract.purgedAt && (
                <Button
                  disabled={busy}
                  onClick={() => run(() => downloadContractPdf(contract.id, contract.customerName))}
                >
                  PDF 다운로드
                </Button>
              )}

              {isActionAllowed(contract.status, 'cancel') && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => mutateContract(contract.id, 'cancel'),
                      '이 계약을 취소할까요? 서명 링크가 무효가 됩니다.',
                    )
                  }
                >
                  계약 취소
                </Button>
              )}

              {/* 같은 고객의 재계약·갱신은 14개 항목을 다시 타이핑하는 자리다.
                  발송 후에는 수정이 막히므로(설계상 의도) 복제해서 새로 만드는 길을 준다. */}
              <Link href={`/admin/contracts/new?from=${contract.id}`} passHref>
                <Button variant="outline">복제해서 새 계약</Button>
              </Link>

              {isActionAllowed(contract.status, 'terminate') && (
                <Button variant="ghost" disabled={busy} onClick={handleTerminate}>
                  이용 종료 처리
                </Button>
              )}

              {isActionAllowed(contract.status, 'delete') && (
                <Button
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  삭제
                </Button>
              )}
            </div>

            {contract.status === 'signed' && (
              <p className="mt-4 text-sm text-gray-500">
                서명이 완료된 계약은 수정·삭제할 수 없습니다. 이용이 끝났다면 “이용 종료
                처리”를 해 주세요 — 계약서는 그대로 보관되고, 그 호실로 새 계약을 만들 수
                있게 됩니다.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
