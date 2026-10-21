import React, { useState } from 'react';
import Head from 'next/head';

import ContractContent from '../../../../../components/contracts/ContractContent';
import ContractNotice from '../../../../../components/contracts/ContractNotice';
import { Button } from '../../../../../components/ui/Button';
import { TextInput } from '../../../../../components/ui/Field';
import { Notice } from '../../../../../components/ui/Notice';
import { getDb } from '../../../../../db/client';
import { formatDate } from '../../../../../lib/contracts/format';
import { IDENTITY_DIGITS } from '../../../../../lib/contracts/identity';
import { lessonSignPath } from '../../../../../lib/contracts/lesson/links';
import { getEffectiveLessonStatus } from '../../../../../lib/contracts/lesson/status';
import { LESSON_CONTRACT_NAME } from '../../../../../lib/contracts/lesson/terms';
import { denyContractPageCaching } from '../../../../../lib/contracts/page-cache';
import { withI18nServerProps } from '../../../../../lib/getStatic';

interface CompletePageProps {
  locale: string;
  contractId: string;
  token: string;
  contract: { studentName: string; signedAt: string | null } | null;
  purged: boolean;
}

const OPERATOR_PHONE = '010-4255-7893';

/**
 * 서명 완료 화면. 생년월일·주소·연락처가 든 서명본 전문은 props(HTML)에 싣지 않는다 — 연락처 뒷자리를 확인한 뒤 API로만 받는다
 * (연습실·제작 계약 완료 화면과 같은 원칙). 토큰 불일치와 부재는 같은 화면으로 묶는다(계약 id의 존재가 새지 않게).
 */
export const getServerSideProps = withI18nServerProps<CompletePageProps>(async (context) => {
  denyContractPageCaching(context.res);
  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;
  const empty = { locale, contractId: id ?? '', token: typeof token === 'string' ? token : '', contract: null, purged: false };
  if (!id || typeof token !== 'string' || token.trim() === '') return { props: empty };
  try {
    const contract = await getDb().query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    if (!contract || !contract.signToken || contract.signToken !== token) return { props: empty };
    // 서명 전이면 서명 화면으로 보낸다(반대 방향은 sign.tsx가 맡는다).
    if (getEffectiveLessonStatus(contract) !== 'signed') return { redirect: { destination: lessonSignPath(id, token, locale), permanent: false } };
    return {
      props: { ...empty, contract: { studentName: contract.studentName, signedAt: contract.signedAt ? contract.signedAt.toISOString() : null }, purged: contract.purgedAt !== null },
    };
  } catch (error: unknown) {
    console.error('[contracts/lesson/[id]/complete] 실패:', error);
    return { props: empty };
  }
});

export default function LessonContractCompletePage({ contractId, token, contract, purged }: CompletePageProps) {
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signedDoc, setSignedDoc] = useState<{ content: string; fingerprint: string | null } | null>(null);

  if (!contract) {
    return (
      <>
        <Head><title>계약서를 찾을 수 없어요 | Studio NOL</title><meta name="robots" content="noindex, nofollow" /></Head>
        <ContractNotice title="계약서를 찾을 수 없어요" description="잘못된 링크예요. 메일이나 카카오톡으로 받은 링크를 다시 확인해 주세요." />
      </>
    );
  }

  const open = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/contracts/lesson/${contractId}/document`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, identityDigits: digits }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) setMessage(result.message || '서명본을 불러오지 못했어요.');
      else setSignedDoc({ content: result.content, fingerprint: result.fingerprint ?? null });
    } catch {
      setMessage('연결을 확인한 뒤 다시 시도해 주세요.');
    }
    setBusy(false);
  };

  return (
    <>
      <Head>
        <title>{`${LESSON_CONTRACT_NAME} 체결 | Studio NOL`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 [color-scheme:light] py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white dark:bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              <p className="text-white/70 dark:text-white/70 text-sm font-medium mb-1">스튜디오 놀 · 서울 은평구 대조동</p>
              <h1 className="typo-page-title text-white dark:text-white">계약이 체결되었어요</h1>
              <p className="text-white dark:text-white/80 mt-2">{contract.studentName}님, {LESSON_CONTRACT_NAME}에 서명해 주셔서 감사해요{contract.signedAt ? ` (${formatDate(new Date(contract.signedAt))})` : ''}.</p>
            </div>
            <div className="p-4 sm:p-6 md:p-10">
              {purged ? (
                <Notice tone="info" light>보관 기간이 지나 계약서의 개인정보가 파기되었어요. 문의는 {OPERATOR_PHONE}으로 해 주세요.</Notice>
              ) : signedDoc ? (
                <>
                  <ContractContent content={signedDoc.content} />
                  {signedDoc.fingerprint && <p className="mt-6 break-all text-xs text-gray-400 dark:text-gray-400">문서 지문 {signedDoc.fingerprint}</p>}
                  <div className="mt-6"><Button light variant="weak" onClick={() => window.print()}>인쇄·PDF로 저장</Button></div>
                </>
              ) : (
                <>
                  <p className="text-gray-700 dark:text-gray-700 leading-relaxed">체결 확인 메일을 보내 드렸어요. 서명본 전문을 보려면 계약서에 등록된 연락처의 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <TextInput type="text" inputMode="numeric" autoComplete="off" maxLength={IDENTITY_DIGITS} value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, IDENTITY_DIGITS))} placeholder={'0'.repeat(IDENTITY_DIGITS)} aria-label={`연락처 뒤 ${IDENTITY_DIGITS}자리`} light className="w-32 text-center tracking-[0.4em] text-lg px-4 py-3 [color-scheme:light]" />
                    <Button light disabled={busy || digits.length !== IDENTITY_DIGITS} onClick={open}>{busy ? '확인 중…' : '서명본 보기'}</Button>
                  </div>
                  {message && <Notice tone="error" light className="mt-4">{message}</Notice>}
                </>
              )}
              <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">궁금한 점은 {OPERATOR_PHONE}으로 문의해 주세요.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// 디자인 판 — lib/designEdition.ts
LessonContractCompletePage.designEdition = 'v2';
