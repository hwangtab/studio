import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../../../components/admin/AdminShell';
import ContractContent from '../../../../components/contracts/ContractContent';
import { Notice } from '../../../../components/ui/Notice';
import { getDb } from '../../../../db/client';
import { authenticateAdminRequest } from '../../../../lib/contracts/admin-auth';
import { parseLessonClauses } from '../../../../lib/contracts/lesson/clauses';
import { verifyLessonFingerprint } from '../../../../lib/contracts/lesson/integrity';
import { LESSON_STATUS_LABEL, getEffectiveLessonStatus } from '../../../../lib/contracts/lesson/status';
import { hasDraftMarker } from '../../../../lib/contracts/lesson/template';
import { logAdminView } from '../../../../lib/privacy/adminView';
import { formatAdminDateTime } from '../../../../lib/admin/displayDate';

/**
 * 수강 계약서 상세(읽기 전용) — 이름·연락처·생년월일·주소가 든 본문이 나오므로 **열람을 접속기록에 남긴다**(`lesson_contract_view`, 값은 적지 않는다).
 * 체결된 계약은 저장된 지문을 다시 계산해 대조한다(파기된 계약은 본문이 지워져 반드시 어긋나므로 대조하지 않는다).
 */
interface Props {
  found: boolean;
  enrollmentId?: string;
  statusLabel?: string;
  content?: string;
  draftMarker?: boolean;
  fingerprint?: { status: string; value: string | null };
  purged?: boolean;
  signedAt?: string | null;
  sentAt?: string | null;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };
  const contractId = typeof context.params?.contractId === 'string' ? context.params.contractId : '';
  const contract = await getDb().query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, contractId) }).catch(() => undefined);
  await logAdminView(context, auth.actor, 'lesson_contract_view', contractId, contract ? 'success' : 'not_found');
  if (!contract) return { props: { found: false } };

  let fingerprint: Props['fingerprint'];
  if (contract.status === 'signed' && !contract.purgedAt && contract.signedAt) {
    const check = verifyLessonFingerprint(contract.contentHash, { contract, clauses: parseLessonClauses(contract.clausesJson), signedAt: contract.signedAt });
    fingerprint = { status: check.status, value: contract.contentHash };
  }
  return {
    props: {
      found: true,
      enrollmentId: contract.enrollmentId,
      statusLabel: LESSON_STATUS_LABEL[getEffectiveLessonStatus(contract)],
      content: contract.content,
      draftMarker: hasDraftMarker(contract.content),
      ...(fingerprint ? { fingerprint } : {}),
      purged: contract.purgedAt !== null,
      signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
      sentAt: contract.sentAt ? contract.sentAt.toISOString() : null,
    },
  };
};

const FINGERPRINT_TEXT: Record<string, string> = {
  match: '문서 지문이 서명 때와 같아요(변조 없음).',
  mismatch: '문서 지문이 서명 때와 달라요 — 본문이 바뀌었을 수 있어요. 확인이 필요해요.',
  unverifiable: '지문 형식을 알 수 없어 대조하지 못했어요.',
};

export default function AdminLessonContractPage({ found, enrollmentId, statusLabel, content, draftMarker, fingerprint, purged, signedAt, sentAt }: Props) {
  return (
    <>
      <Head><title>수강 계약서 | Studio NOL</title><meta name="robots" content="noindex, nofollow" /></Head>
      <AdminShell title="수강 계약서" backHref={enrollmentId ? `/admin/lessons/${enrollmentId}` : '/admin/lessons'} backLabel="수강 상세" width="wide">
        {!found ? (
          <Notice tone="warning" light>계약을 찾을 수 없어요(마이그레이션 0082 적용 전이거나 지워진 건).</Notice>
        ) : (
          <>
            <section className="rounded-2xl bg-white p-4 text-sm text-gray-900 shadow-sm md:p-6">
              <p><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">{statusLabel}</span>{sentAt && <span className="ml-2 text-gray-600">발송 {formatAdminDateTime(sentAt)}</span>}{signedAt && <span className="ml-2 text-gray-600">체결 {formatAdminDateTime(signedAt)}</span>}</p>
              {draftMarker && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-900">이 문안에는 <strong>확정 전 조항(제9조 환불)</strong>이 남아 있어 발송할 수 없어요. 교습비 반환 기준을 법률 확인한 뒤 문안을 확정해야 해요.</p>}
              {fingerprint && <p className={`mt-2 ${fingerprint.status === 'mismatch' ? 'font-semibold text-red-700' : 'text-gray-600'}`}>{FINGERPRINT_TEXT[fingerprint.status] ?? fingerprint.status}{fingerprint.value ? <span className="ml-1 break-all text-xs text-gray-400">{fingerprint.value}</span> : null}</p>}
              {purged && <p className="mt-2 text-gray-600">보관 기간이 지나 개인정보가 파기된 계약이에요.</p>}
            </section>
            <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-8"><ContractContent content={content ?? ''} /></section>
            {enrollmentId && <p className="mt-4 text-sm"><Link href={`/admin/lessons/${enrollmentId}`} className="text-primary hover:underline">수강 상세로 돌아가기</Link></p>}
          </>
        )}
      </AdminShell>
    </>
  );
}
