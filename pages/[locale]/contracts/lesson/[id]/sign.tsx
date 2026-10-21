import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractContent from '../../../../../components/contracts/ContractContent';
import ContractNotice from '../../../../../components/contracts/ContractNotice';
import ContractSignNav, { SIGNATURE_SECTION_ID } from '../../../../../components/contracts/ContractSignNav';
import { focusFirstMissing, MISSING_RING, type MissingItem } from '../../../../../components/contracts/missingGuide';
import { SignaturePad, type SignaturePadHandle } from '../../../../../components/contracts/SignaturePad';
import { Button } from '../../../../../components/ui/Button';
import { Field, TextInput } from '../../../../../components/ui/Field';
import { Notice } from '../../../../../components/ui/Notice';
import { lightOnlyField } from '../../../../../components/ui/adminFieldClass';
import { getDb } from '../../../../../db/client';
import { birthdateErrorMessage, formatBirthdateInput, isUnder19, parseBirthdate } from '../../../../../lib/contracts/birthdate';
import { IDENTITY_DIGITS, maskIdentityDigitsInContent } from '../../../../../lib/contracts/identity';
import { parseLessonClauses, type LessonClause } from '../../../../../lib/contracts/lesson/clauses';
import { lessonCompletePath } from '../../../../../lib/contracts/lesson/links';
import { expireOverdueLessonContracts, markLessonContractViewed } from '../../../../../lib/contracts/lesson/service';
import { getEffectiveLessonStatus } from '../../../../../lib/contracts/lesson/status';
import { LESSON_CONTRACT_NAME } from '../../../../../lib/contracts/lesson/terms';
import { denyContractPageCaching } from '../../../../../lib/contracts/page-cache';
import { clearDraft, readDraft, writeDraft } from '../../../../../lib/contracts/sign-draft';
import { withI18nServerProps } from '../../../../../lib/getStatic';

type UnavailableReason = 'expired' | 'cancelled' | 'superseded';

interface LessonSignPageProps {
  locale: string;
  token: string;
  /** 화면이 그리는 값만 싣는다 — props는 __NEXT_DATA__로 HTML에 그대로 실린다. */
  contract: { id: string; studentName: string; content: string } | null;
  clauses: LessonClause[];
  unavailable?: UnavailableReason;
  error?: string;
}

const OPERATOR_PHONE = '010-4255-7893';

/**
 * 수강생 서명 화면 — 연습실·제작 계약 서명 화면과 같은 흐름: 공유 캐시 차단 → 링크 판정(사이트 404 대신 계약 맥락의 안내) →
 * 서명이 끝났으면 완료 화면 → 열람 기록 → 본문(연락처 뒷자리 가림) → 생년월일·주소 → 필수 동의 → 본인 확인 → 서명.
 */
export const getServerSideProps = withI18nServerProps<LessonSignPageProps>(async (context) => {
  denyContractPageCaching(context.res);
  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;
  if (!id || typeof token !== 'string' || token.trim() === '') return { notFound: true };
  const empty = { locale, token, contract: null, clauses: [] };

  try {
    await expireOverdueLessonContracts();
    const contract = await getDb().query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    // 대부분 재발송으로 무효가 된 옛 링크를 누른 당사자다 — "찾을 수 없다" 대신 할 일을 알려 준다.
    if (!contract || !contract.signToken || contract.signToken !== token || contract.purgedAt) {
      return { props: { ...empty, unavailable: 'superseded' as const } };
    }
    const status = getEffectiveLessonStatus(contract);
    if (status === 'signed') return { redirect: { destination: lessonCompletePath(id, token, locale), permanent: false } };
    if (status !== 'sent') return { props: { ...empty, unavailable: status === 'cancelled' ? ('cancelled' as const) : ('expired' as const) } };

    await markLessonContractViewed(contract.id);
    return {
      props: {
        locale, token,
        contract: {
          id: contract.id,
          studentName: contract.studentName,
          // 연락처는 본인 확인의 정답이라 본문에서도 가린다. 서명본에는 전체 번호가 들어간다.
          content: maskIdentityDigitsInContent(contract.content, contract.studentPhone),
        },
        clauses: parseLessonClauses(contract.clausesJson),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/lesson/[id]/sign] Failed to load contract:', error);
    return { props: { ...empty, error: `지금 계약서를 불러올 수 없어요. 잠시 후 링크를 다시 열어 주세요. 계속 안 되면 ${OPERATOR_PHONE}으로 연락해 주세요.` } };
  }
});

const UNAVAILABLE_COPY: Record<UnavailableReason, { headTitle: string; title: string; description: string }> = {
  expired: { headTitle: '서명 링크 만료', title: '서명 링크가 만료되었어요', description: '보안을 위해 서명 링크는 일정 기간이 지나면 쓸 수 없어요. 스튜디오에 다시 보내 달라고 요청해 주세요.' },
  superseded: { headTitle: '사용할 수 없는 링크', title: '이 서명 링크는 더 이상 쓸 수 없어요', description: '계약서를 다시 보내 드렸다면 가장 최근에 받은 링크(메일 또는 카카오톡)를 열어 주세요. 최근 링크가 없다면 스튜디오에 다시 보내 달라고 요청해 주세요.' },
  cancelled: { headTitle: '취소된 계약', title: '취소된 계약이에요', description: '이 계약은 스튜디오가 취소했어요. 내용이 맞지 않는다면 스튜디오로 문의해 주세요.' },
};

const FIELD_ORDER = ['studentBirthdate', 'studentAddress'];
const CHECKBOX_CLASS = 'mt-1 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 focus-visible:ring-offset-white';

export default function LessonContractSignPage({ locale, token, contract, clauses, unavailable, error }: LessonSignPageProps) {
  const router = useRouter();
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const [hasSigned, setHasSigned] = useState(false);
  const [birthdate, setBirthdate] = useState('');
  const [address, setAddress] = useState('');
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [identityDigits, setIdentityDigits] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [agreements, setAgreements] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allAgreed = contract !== null && clauses.every((clause) => agreements[clause.key]);
  const birthdateParse = parseBirthdate(birthdate);
  const under19 = isUnder19(birthdate);
  const detailsReady = birthdateParse.ok && address.trim() !== '';
  const identityReady = identityDigits.length === IDENTITY_DIGITS && identityConfirmed;
  const ready = detailsReady && allAgreed && identityReady && hasSigned;

  const missing: MissingItem[] = [
    ...(!birthdateParse.ok ? [{ id: 'studentBirthdate', label: '생년월일' }] : []),
    ...(!address.trim() ? [{ id: 'studentAddress', label: '주소' }] : []),
    ...clauses.filter((clause) => !agreements[clause.key]).map((clause) => ({ id: `clause-${clause.key}`, label: `${clause.title} 체크` })),
    ...(identityDigits.length !== IDENTITY_DIGITS ? [{ id: 'identityDigits', label: `연락처 뒤 ${IDENTITY_DIGITS}자리` }] : []),
    ...(!identityConfirmed ? [{ id: 'identity-confirmed', label: '본인 확인 체크' }] : []),
    ...(!hasSigned ? [{ id: 'signature-pad', label: '서명' }] : []),
  ];
  const isMissing = (id: string) => showMissing && missing.some((item) => item.id === id);
  const requiredError = (id: string) => (isMissing(id) ? '입력해 주세요.' : undefined);
  const clearFieldError = (field: string) =>
    setDetailErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  // 앱 전환으로 다시 열려도 생년월일·주소를 다시 치지 않게(lib/contracts/sign-draft.ts). 마운트 뒤에 읽는다.
  useEffect(() => {
    if (!contract) return;
    const draft = readDraft(contract.id);
    if (draft.customerBirthdate) setBirthdate(formatBirthdateInput(draft.customerBirthdate));
    if (draft.customerAddress) setAddress(draft.customerAddress);
  }, [contract]);
  useEffect(() => {
    if (!contract) return;
    if (birthdate === '' && address === '') {
      clearDraft(contract.id);
      return;
    }
    writeDraft(contract.id, { customerBirthdate: birthdate, customerAddress: address });
  }, [contract, birthdate, address]);

  if (unavailable) {
    const copy = UNAVAILABLE_COPY[unavailable];
    return (
      <>
        <Head><title>{`${copy.headTitle} | Studio NOL`}</title><meta name="robots" content="noindex, nofollow" /></Head>
        <ContractNotice title={copy.title} description={copy.description} />
      </>
    );
  }
  if (error || !contract) {
    const title = error ? '계약서를 여는 중 문제가 생겼어요' : '계약서를 찾을 수 없어요';
    return (
      <>
        <Head><title>{`${title} | Studio NOL`}</title><meta name="robots" content="noindex, nofollow" /></Head>
        <ContractNotice title={title} description={error || '잘못된 링크예요. 메일이나 카카오톡으로 받은 링크를 다시 확인해 주세요.'} />
      </>
    );
  }

  const completePath = lessonCompletePath(contract.id, token, locale);

  const handleSubmit = async () => {
    if (!ready) return;
    const signatureData = signaturePadRef.current?.toDataURL();
    if (!signatureData) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/contracts/lesson/${contract.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, signatureData, agreements: clauses.map((clause) => clause.key), identityDigits, identityConfirmed,
          studentBirthdate: birthdateParse.ok ? birthdateParse.value : '', studentAddress: address.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      // 응답 전에 연결이 끊겨 다시 누른 경우 — 서버에서는 이미 체결됐다. 완료 화면이 사실에 맞다.
      if (response.status === 409 && result.status === 'signed') {
        clearDraft(contract.id);
        await router.push(completePath);
        return;
      }
      if (!response.ok || !result.ok) {
        if (Array.isArray(result.errors)) {
          const map: Record<string, string> = {};
          for (const item of result.errors) if (item && typeof item.field === 'string' && typeof item.message === 'string') map[item.field] = item.message;
          setDetailErrors(map);
          const failed = FIELD_ORDER.filter((field) => field in map);
          if (failed.length > 0) window.setTimeout(() => focusFirstMissing(failed.map((id) => ({ id, label: id }))), 0);
        }
        throw new Error(result.message || '서명 제출에 실패했어요.');
      }
      setDetailErrors({});
      clearDraft(contract.id);
      await router.push(completePath);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof TypeError
          ? '제출 결과를 확인하지 못했어요. 연결을 확인한 뒤 아래 버튼을 다시 눌러 주세요. 이미 접수됐다면 완료 화면으로 이동해요.'
          : err instanceof Error ? err.message : '서명 제출 중 오류가 생겼어요.',
      );
      setSubmitting(false);
    }
  };

  const pendingHint = !detailsReady ? '생년월일과 주소를 입력해 주세요.' : !allAgreed ? '모든 동의 항목에 체크해 주세요.' : !identityReady ? '본인 확인을 완료해 주세요.' : '서명을 입력해 주세요.';

  return (
    <>
      <Head>
        <title>{`${LESSON_CONTRACT_NAME} — 서명 요청 | Studio NOL`}</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* URL에 서명 토큰이 있다. 외부로 나가는 요청에 Referer로 실리지 않게 막는다. */}
        <meta name="referrer" content="no-referrer" />
      </Head>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 [color-scheme:light] py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white dark:bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              {/* 사이트 헤더가 없으므로 여기서 보낸 곳을 밝힌다 — 메일로 들어온 사람이 피싱과 구별할 근거다. */}
              <p className="text-white/70 dark:text-white/70 text-sm font-medium mb-1">스튜디오 놀 · 서울 은평구 대조동</p>
              <h1 className="typo-page-title text-white dark:text-white">{LESSON_CONTRACT_NAME}</h1>
              <p className="text-white dark:text-white/80 mt-2">{contract.studentName}님, 아래 내용을 확인하고 서명해 주세요. 스튜디오는 이미 서명했어요.</p>
            </div>

            <div className="p-4 sm:p-6 md:p-10">
              <ContractSignNav content={contract.content} />
              <ContractContent content={contract.content} />

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">수강생 정보</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4 leading-relaxed">아래 항목은 계약서에 그대로 기재돼요. 정확히 입력해 주세요.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field id="studentBirthdate" label="생년월일" required hint="숫자 8자리로 적어요. 예: 19900115" error={detailErrors.studentBirthdate ?? birthdateErrorMessage(birthdateParse, isMissing('studentBirthdate'))} className={lightOnlyField}>
                    <TextInput type="text" inputMode="numeric" value={birthdate} onChange={(e) => { setBirthdate(formatBirthdateInput(e.target.value)); clearFieldError('studentBirthdate'); }} maxLength={10} placeholder="예: 19900115" autoComplete="bday" light className="px-4 py-3" />
                  </Field>
                  {under19 && (
                    <Notice tone="warning" light className="md:col-span-2">
                      만 19세 미만은 이 화면에서 서명할 수 없어요. {OPERATOR_PHONE}으로 연락해 주세요.
                    </Notice>
                  )}
                  <Field id="studentAddress" label="주소" required error={detailErrors.studentAddress ?? requiredError('studentAddress')} className={lightOnlyField}>
                    <TextInput value={address} onChange={(e) => { setAddress(e.target.value); clearFieldError('studentAddress'); }} placeholder="예: 서울시 은평구 대조동 00-0" autoComplete="street-address" light className="px-4 py-3" />
                  </Field>
                </div>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-4">필수 동의</h2>
                <div className="space-y-3">
                  {clauses.map((clause) => (
                    <label key={clause.key} id={`clause-${clause.key}`} className={`flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 ${isMissing(`clause-${clause.key}`) ? MISSING_RING : ''}`}>
                      <input type="checkbox" className={CHECKBOX_CLASS} checked={agreements[clause.key] || false} onChange={(e) => setAgreements((prev) => ({ ...prev, [clause.key]: e.target.checked }))} />
                      <span className="text-gray-700 dark:text-gray-700">
                        <span className="font-semibold">{clause.title}</span> — 아래 내용을 확인했고 동의해요.
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-600">
                          {clause.points.map((point) => <li key={point}>{point}</li>)}
                        </ul>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">본인 확인</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  계약서에 등록된 연락처의 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.
                  <span className="block mt-1 text-gray-500 dark:text-gray-500">본인 확인을 위해 위 계약서에서는 이 자리를 가려 두었어요. 서명이 끝난 계약서에는 전체 번호가 기재돼요.</span>
                </p>
                <TextInput
                  type="text" inputMode="numeric" autoComplete="off" maxLength={IDENTITY_DIGITS} value={identityDigits}
                  onChange={(e) => setIdentityDigits(e.target.value.replace(/\D/g, '').slice(0, IDENTITY_DIGITS))}
                  placeholder={'0'.repeat(IDENTITY_DIGITS)} aria-label={`연락처 뒤 ${IDENTITY_DIGITS}자리`} id="identityDigits"
                  invalid={isMissing('identityDigits') || undefined} light className="w-32 text-center tracking-[0.4em] text-lg px-4 py-3 [color-scheme:light]"
                />
                <label id="identity-confirmed" className={`mt-5 flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 ${isMissing('identity-confirmed') ? MISSING_RING : ''}`}>
                  <input type="checkbox" className={CHECKBOX_CLASS} checked={identityConfirmed} onChange={(e) => setIdentityConfirmed(e.target.checked)} />
                  <span className="text-gray-700 dark:text-gray-700">본인이 계약 당사자임을 확인하며, 위 계약 내용을 모두 읽고 이해했어요. 아래 <strong>전자서명</strong>이 자필 서명과 같은 효력을 가지는 데 동의해요.</span>
                </label>
              </div>

              <div id={SIGNATURE_SECTION_ID} className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">전자서명</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">아래 영역에 마우스나 손가락으로 서명해 주세요.</p>
                <div id="signature-pad" tabIndex={-1} className={`rounded-xl focus:outline-none ${isMissing('signature-pad') ? MISSING_RING : ''}`}>
                  <SignaturePad ref={signaturePadRef} onSignedChange={setHasSigned} />
                </div>
              </div>

              {submitError && <Notice tone="error" light className="mt-6">{submitError}</Notice>}

              <div className="mt-8">
                {/* 버튼은 늘 눌린다 — 빠진 게 있으면 그 자리로 옮기고 표시한다(missingGuide.ts). */}
                {showMissing && missing.length > 0 && (
                  <p role="alert" className="mb-3 text-center text-sm font-medium text-red-600 dark:text-red-600">아직 남은 항목: {missing.map((item) => item.label).join(', ')}</p>
                )}
                <Button light size="lg" fullWidth disabled={submitting} onClick={() => { if (!ready) { setShowMissing(true); focusFirstMissing(missing); return; } void handleSubmit(); }}>
                  {submitting ? '처리 중...' : '계약서 서명 완료'}
                </Button>
                {!submitting && !ready && !showMissing && <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-500">{pendingHint}</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// 디자인 판 — lib/designEdition.ts
LessonContractSignPage.designEdition = 'v2';
