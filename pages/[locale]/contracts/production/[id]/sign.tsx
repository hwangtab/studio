import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import ContractContent from '../../../../../components/contracts/ContractContent';
import ContractNotice from '../../../../../components/contracts/ContractNotice';
import { SignaturePad, type SignaturePadHandle } from '../../../../../components/contracts/SignaturePad';
import { Button } from '../../../../../components/ui/Button';
import { Field, TextInput } from '../../../../../components/ui/Field';
import { Notice } from '../../../../../components/ui/Notice';
import { lightOnlyField } from '../../../../../components/ui/adminFieldClass';
import { getDb } from '../../../../../db/client';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { IDENTITY_DIGITS, maskIdentityDigitsInContent } from '../../../../../lib/contracts/identity';
import { denyContractPageCaching } from '../../../../../lib/contracts/page-cache';
import { parseStoredClauses, type ProductionClause } from '../../../../../lib/contracts/production/clauses';
import { productionCompletePath } from '../../../../../lib/contracts/production/links';
import { expireOverdueProductionContracts } from '../../../../../lib/contracts/production/service';
import { getEffectiveProductionStatus, hasSignedDocument } from '../../../../../lib/contracts/production/status';
import { contractNameFor } from '../../../../../lib/contracts/production/terms';
import { isOpenProductionContract } from '../../../../../lib/contracts/production/open-link';
import { recordProductionSignerView } from '../../../../../lib/contracts/production/view-log';
import { clearDraft, readDraft, writeDraft } from '../../../../../lib/contracts/sign-draft';
import { withI18nServerProps } from '../../../../../lib/getStatic';

type UnavailableReason = 'expired' | 'cancelled' | 'superseded';

interface ProductionSignPageProps {
  locale: string;
  token: string;
  /** 화면이 그리는 값만 싣는다 — props는 __NEXT_DATA__로 HTML에 그대로 실린다(연습실 sign.tsx 주석). */
  contract: { id: string; title: string; clientName: string; content: string; contractName: string; openLink: boolean } | null;
  /** 이 링크의 서명자. 법정대리인은 생년월일·주소를 채우지 않는다(의뢰인 정보다). */
  signer: { role: 'client' | 'guardian'; name: string; relation: string | null } | null;
  clauses: ProductionClause[];
  unavailable?: UnavailableReason;
  error?: string;
}

const OPERATOR_PHONE = '010-4255-7893';

/**
 * 의뢰인 서명 화면. 흐름·원칙은 연습실 서명 화면(pages/[locale]/contracts/[id]/sign.tsx)과 같다:
 * 공유 캐시 차단 → 링크 판정(사이트 404 대신 계약 맥락의 안내) → 서명이 끝났으면 완료 화면 → 열람 기록 →
 * 본문(연락처 뒷자리 가림) → 생년월일·주소 → 필수 동의 → 본인 확인 → 서명.
 */
export const getServerSideProps = withI18nServerProps<ProductionSignPageProps>(async (context) => {
  denyContractPageCaching(context.res);

  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;
  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  const empty = { locale, token, contract: null, signer: null, clauses: [] };

  try {
    await expireOverdueProductionContracts();

    const contract = await getDb().query.productionContracts.findFirst({
      where: (t, { eq }) => eq(t.id, id),
      with: { signers: true },
    });
    const linkSigner = contract?.signers.find(
      (signer) => (signer.role === 'client' || signer.role === 'guardian') && signer.signToken === token,
    );

    // 대부분 재발송으로 무효가 된 옛 링크를 누른 당사자다 — "찾을 수 없다" 대신 할 일을 알려 준다.
    if (!contract || !linkSigner) {
      return { props: { ...empty, unavailable: 'superseded' as const } };
    }

    const status = getEffectiveProductionStatus(contract);
    // 이 사람은 이미 서명했다 — 상대(의뢰인·대리인) 서명을 기다리는 중이어도 완료 화면이 맞는 자리다.
    if (hasSignedDocument(status) || ((status === 'sent' || status === 'expired') && linkSigner.status === 'signed')) {
      return { redirect: { destination: productionCompletePath(id, token, locale), permanent: false } };
    }
    if (status !== 'sent') {
      return { props: { ...empty, unavailable: status === 'cancelled' ? ('cancelled' as const) : ('expired' as const) } };
    }

    await recordProductionSignerView(linkSigner.id, token, getClientIp(context.req), new Date(), String(context.req.headers['user-agent'] || ''));
    // 서명자마다 연락처 뒷자리가 본인 확인의 정답이다 — 내 번호만이 아니라 상대(의뢰인·법정대리인) 번호도 가린다.
    // 의뢰인 화면에 대리인 번호가 보이면 미성년 의뢰인이 대리인 링크까지 혼자 열 수 있다.
    const identityPhones = [contract.clientPhone, ...contract.signers.map((signer) => signer.phone ?? '')].filter(Boolean);

    return {
      props: {
        locale,
        token,
        contract: {
          id: contract.id,
          title: contract.title,
          clientName: contract.clientName,
          contractName: contractNameFor(contract.kind),
          // 링크 계약 — 의뢰인이 이름·이메일·연락처를 여기서 채우고 뒷자리 확인을 하지 않는다(open-link.ts).
          openLink: isOpenProductionContract(contract),
          // 서명자들의 연락처는 본인 확인의 정답이라 본문에서도 가린다. 서명본에는 전체 번호가 들어간다.
          content: identityPhones.reduce((content, phone) => maskIdentityDigitsInContent(content, phone), contract.content),
        },
        signer: {
          role: linkSigner.role === 'guardian' ? ('guardian' as const) : ('client' as const),
          name: linkSigner.name,
          relation: linkSigner.relation,
        },
        clauses: parseStoredClauses(contract.clausesJson),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/production/[id]/sign] Failed to load contract:', error);
    return {
      props: {
        ...empty,
        error: `지금 계약서를 불러올 수 없습니다. 잠시 후 링크를 다시 열어 주세요. 계속 안 되면 ${OPERATOR_PHONE}으로 연락해 주세요.`,
      },
    };
  }
});

const UNAVAILABLE_COPY: Record<UnavailableReason, { headTitle: string; title: string; description: string }> = {
  expired: {
    headTitle: '서명 링크 만료',
    title: '서명 링크가 만료되었습니다',
    description: '보안을 위해 서명 링크는 일정 기간이 지나면 사용할 수 없습니다. 운영자에게 재발송을 요청해 주세요.',
  },
  superseded: {
    headTitle: '사용할 수 없는 링크',
    title: '이 서명 링크는 더 이상 사용할 수 없습니다',
    description:
      '계약서를 다시 보내 드렸다면 가장 최근에 받으신 링크(메일 또는 카카오톡)를 열어 주세요. 최근 링크가 없다면 운영자에게 재발송을 요청해 주세요.',
  },
  cancelled: {
    headTitle: '취소된 계약',
    title: '취소된 계약입니다',
    description: '이 계약은 운영자가 취소했습니다. 내용이 맞지 않는다면 스튜디오로 문의해 주세요.',
  },
};

const CHECKBOX_CLASS =
  'mt-1 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 focus-visible:ring-offset-white';

export default function ProductionContractSignPage({
  locale,
  token,
  contract,
  signer,
  clauses,
  unavailable,
  error,
}: ProductionSignPageProps) {
  const router = useRouter();
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  const [hasSigned, setHasSigned] = useState(false);
  const [clientBirthdate, setClientBirthdate] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [identityDigits, setIdentityDigits] = useState('');
  // 링크 계약에서 의뢰인이 채우는 칸.
  const [openName, setOpenName] = useState('');
  const [openStageName, setOpenStageName] = useState('');
  const [openEmail, setOpenEmail] = useState('');
  const [openPhone, setOpenPhone] = useState('');
  const [openEmailConfirm, setOpenEmailConfirm] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [agreements, setAgreements] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allAgreed = contract !== null && clauses.every((clause) => agreements[clause.key]);
  const isGuardian = signer?.role === 'guardian';
  const openLink = !isGuardian && contract?.openLink === true;
  const identityReady = (openLink || identityDigits.length === IDENTITY_DIGITS) && identityConfirmed;
  // 이메일은 두 번 받는다 — 서명본 PDF(생년월일·주소·서명 포함)가 이 주소로 가고, 서명 뒤에는 고칠 수 없다.
  const emailMismatch = openLink && openEmailConfirm.trim() !== '' && openEmailConfirm.trim().toLowerCase() !== openEmail.trim().toLowerCase();
  const openReady =
    !openLink ||
    (openName.trim() !== '' && openEmail.trim() !== '' && openPhone.trim() !== '' && openEmailConfirm.trim() !== '' && !emailMismatch);
  /** 칸을 고치면 그 칸의 서버 오류를 지운다 — 고친 뒤에도 옛 오류가 남아 있으면 무엇이 틀렸는지 헷갈린다. */
  const clearFieldError = (field: string) =>
    setDetailErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  const detailsReady = isGuardian || (clientBirthdate !== '' && clientAddress.trim() !== '' && openReady);
  const ready = detailsReady && allAgreed && identityReady && hasSigned;

  // 앱 전환으로 다시 열려도 생년월일·주소를 다시 치지 않게(lib/contracts/sign-draft.ts 주석). 마운트 뒤에 읽는다.
  useEffect(() => {
    if (!contract) return;
    const draft = readDraft(contract.id);
    if (draft.customerBirthdate) setClientBirthdate(draft.customerBirthdate);
    if (draft.customerAddress) setClientAddress(draft.customerAddress);
    // 링크 계약의 이름·활동명·연락처·이메일도 — 카톡 인앱 브라우저에서 앱을 오가면 다시 열린다(sign-draft.ts).
    if (draft.clientName) setOpenName(draft.clientName);
    if (draft.clientStageName) setOpenStageName(draft.clientStageName);
    if (draft.clientPhone) setOpenPhone(draft.clientPhone);
    if (draft.clientEmail) setOpenEmail(draft.clientEmail);
  }, [contract]);

  useEffect(() => {
    if (!contract) return;
    const values = { customerBirthdate: clientBirthdate, customerAddress: clientAddress, clientName: openName, clientStageName: openStageName, clientPhone: openPhone, clientEmail: openEmail };
    if (Object.values(values).every((value) => value === '')) {
      clearDraft(contract.id);
      return;
    }
    writeDraft(contract.id, values);
  }, [contract, clientBirthdate, clientAddress, openName, openStageName, openPhone, openEmail]);

  if (unavailable) {
    const copy = UNAVAILABLE_COPY[unavailable];
    return (
      <>
        <Head>
          <title>{`${copy.headTitle} | Studio NOL`}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice title={copy.title} description={copy.description} />
      </>
    );
  }

  if (error || !contract) {
    const title = error ? '계약서를 여는 중 문제가 생겼습니다' : '계약서를 찾을 수 없습니다';
    return (
      <>
        <Head>
          <title>{`${title} | Studio NOL`}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice title={title} description={error || '잘못된 링크입니다. 메일이나 카카오톡으로 받은 링크를 다시 확인해 주세요.'} />
      </>
    );
  }

  const completePath = productionCompletePath(contract.id, token, locale);

  const handleSubmit = async () => {
    if (!ready) return;
    const signatureData = signaturePadRef.current?.toDataURL();
    if (!signatureData) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/contracts/production/${contract.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureData,
          agreements: clauses.map((clause) => clause.key),
          identityDigits,
          identityConfirmed,
          ...(isGuardian ? {} : { clientBirthdate, clientAddress: clientAddress.trim() }),
          ...(openLink
            ? { clientName: openName.trim(), clientStageName: openStageName.trim(), clientEmail: openEmail.trim(), clientPhone: openPhone.trim() }
            : {}),
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
          for (const item of result.errors) {
            if (item && typeof item.field === 'string' && typeof item.message === 'string') map[item.field] = item.message;
          }
          setDetailErrors(map);
        }
        throw new Error(result.message || '서명 제출에 실패했습니다.');
      }

      setDetailErrors({});
      clearDraft(contract.id);
      await router.push(completePath);
    } catch (err: unknown) {
      // 네트워크 끊김은 "Failed to fetch"를 그대로 보여 주지 않는다 — 실제로 접수됐을 수 있다.
      setSubmitError(
        err instanceof TypeError
          ? '제출 결과를 확인하지 못했습니다. 연결을 확인한 뒤 아래 버튼을 다시 눌러 주세요. 이미 접수되었다면 완료 화면으로 이동합니다.'
          : err instanceof Error
            ? err.message
            : '서명 제출 중 오류가 발생했습니다.',
      );
      setSubmitting(false);
    }
  };

  const pendingHint = !detailsReady
    ? openLink && !openReady
      ? emailMismatch
        ? '이메일 확인 칸이 위의 이메일과 같지 않아요.'
        : '성명·휴대폰 번호·이메일(확인 포함)을 입력해 주세요.'
      : '생년월일과 주소를 입력해 주세요.'
    : !allAgreed
      ? '모든 동의 항목에 체크해 주세요.'
      : !identityReady
        ? '본인 확인을 완료해 주세요.'
        : '서명을 입력해 주세요.';

  const clientInfo = (
              <div className={openLink ? 'mb-10 border-b border-gray-200 dark:border-gray-200 pb-8' : 'mt-10 border-t border-gray-200 dark:border-gray-200 pt-8'}>
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">의뢰인 정보</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4 leading-relaxed">
                  아래 항목은 계약서에 그대로 기재돼요. 정확히 입력해 주세요.
                  {openLink && ' 서명한 계약서(PDF)는 적어 주신 이메일로 보내 드려요. 이메일이 틀리면 다른 사람에게 갈 수 있으니 한 번 더 확인해 주세요.'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {openLink && (
                    <>
                      <Field id="clientName" label="성명(실명)" required error={detailErrors.clientName} className={lightOnlyField}>
                        <TextInput value={openName} onChange={(e) => { setOpenName(e.target.value); clearFieldError('clientName'); }} autoComplete="name" light className="px-4 py-3" />
                      </Field>
                      <Field id="clientStageName" label="활동명" error={detailErrors.clientStageName} className={lightOnlyField}>
                        <TextInput value={openStageName} onChange={(e) => { setOpenStageName(e.target.value); clearFieldError('clientStageName'); }} placeholder="없으면 비워 두세요" autoComplete="nickname" light className="px-4 py-3" />
                      </Field>
                      <Field id="clientPhone" label="휴대폰 번호" required error={detailErrors.clientPhone} className={lightOnlyField}>
                        <TextInput
                          type="tel"
                          inputMode="tel"
                          value={openPhone}
                          onChange={(e) => { setOpenPhone(e.target.value); clearFieldError('clientPhone'); }}
                          placeholder="010-1234-5678"
                          autoComplete="tel"
                          light
                          className="px-4 py-3"
                        />
                      </Field>
                      <Field id="clientEmail" label="이메일" required error={detailErrors.clientEmail} className={lightOnlyField}>
                        <TextInput
                          type="email"
                          inputMode="email"
                          value={openEmail}
                          onChange={(e) => { setOpenEmail(e.target.value); clearFieldError('clientEmail'); }}
                          placeholder="name@example.com"
                          autoComplete="email"
                          light
                          className="px-4 py-3"
                        />
                      </Field>
                      <Field id="clientEmailConfirm" label="이메일 확인" required error={emailMismatch ? '위에 적은 이메일과 같지 않아요.' : undefined} className={lightOnlyField}>
                        <TextInput
                          type="email"
                          inputMode="email"
                          value={openEmailConfirm}
                          onChange={(e) => setOpenEmailConfirm(e.target.value)}
                          placeholder="이메일을 한 번 더 적어 주세요"
                          autoComplete="off"
                          light
                          className="px-4 py-3"
                        />
                      </Field>
                    </>
                  )}
                  <Field id="clientBirthdate" label="생년월일" required error={detailErrors.clientBirthdate} className={lightOnlyField}>
                    <TextInput
                      type="date"
                      value={clientBirthdate}
                      onChange={(e) => { setClientBirthdate(e.target.value); clearFieldError('clientBirthdate'); }}
                      max={new Date().toISOString().slice(0, 10)}
                      autoComplete="bday"
                      light
                      className="px-4 py-3 [color-scheme:light]"
                    />
                  </Field>
                  <Field id="clientAddress" label="주소" required error={detailErrors.clientAddress} className={lightOnlyField}>
                    <TextInput
                      value={clientAddress}
                      onChange={(e) => { setClientAddress(e.target.value); clearFieldError('clientAddress'); }}
                      placeholder="예: 서울시 은평구 대조동 00-0"
                      autoComplete="street-address"
                      light
                      className="px-4 py-3"
                    />
                  </Field>
                </div>
              </div>
  );

  return (
    <>
      <Head>
        <title>{`${contract.contractName} — 서명 요청 | Studio NOL`}</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* URL에 서명 토큰이 있다. 외부로 나가는 요청에 Referer로 실리지 않게 막는다. */}
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white dark:bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              {/* 사이트 헤더가 없으므로 여기서 보낸 곳을 밝힌다 — 메일로 들어온 사람이 피싱과 구별할 근거다. */}
              <p className="text-white/70 dark:text-white/70 text-sm font-medium mb-1">스튜디오 놀 · 서울 은평구 대조동</p>
              <h1 className="typo-page-title text-white dark:text-white">{contract.contractName}</h1>
              <p className="text-white dark:text-white/80 mt-2">
                {isGuardian && signer
                  ? `${signer.name}님, ${contract.clientName}님의 법정대리인(${signer.relation ?? '보호자'})으로 아래 계약에 함께 서명해 주세요. 스튜디오는 이미 서명했어요.`
                  : `${contract.clientName ? `${contract.clientName}님, ` : ''}아래 내용을 확인하고 서명해 주세요. 스튜디오는 이미 서명했어요.`}
              </p>
            </div>

            <div className="p-6 md:p-10">
              {/* 링크 계약은 의뢰인이 누구인지 서명 전에는 모른다 — 입력 칸을 본문 위에 둔다(본문을 끝까지 내려야 나오면 헷갈린다). */}
              {openLink && clientInfo}
              <ContractContent content={contract.content} />

              {/* 생년월일·주소는 의뢰인 본인 정보다 — 법정대리인 화면에서는 받지 않는다. */}
              {!isGuardian && !openLink && clientInfo}

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-4">필수 동의</h2>
                <div className="space-y-3">
                  {clauses.map((clause) => (
                    <label
                      key={clause.key}
                      className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        checked={agreements[clause.key] || false}
                        onChange={(e) => setAgreements((prev) => ({ ...prev, [clause.key]: e.target.checked }))}
                      />
                      {clause.points ? (
                        // 새 계약은 중요 조항 요약 하나를 한 번에 확인받는다(clauses.ts buildProductionClauses).
                        <span className="text-gray-700 dark:text-gray-700">
                          <span className="font-semibold">{clause.title}</span> — 아래 내용을 확인했고 동의해요.
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-600">
                            {clause.points.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        </span>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-700">
                          <span className="font-semibold">{clause.clauseNumber}</span> {clause.title}에 동의해요.
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">본인 확인</h2>
                {openLink && (
                  <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                    이 계약은 연락처 대조 없이, 스튜디오가 보내 드린 링크로 서명해요. 링크를 받은 본인만 서명해 주세요 — 다른 사람에게
                    링크를 전달하지 마세요.
                  </p>
                )}
                {!openLink && (
                <>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  계약서에 등록된 {isGuardian ? '법정대리인님 ' : ''}연락처의 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.
                  <span className="block mt-1 text-gray-500 dark:text-gray-500">
                    본인 확인을 위해 위 계약서에서는 이 자리를 가려 두었어요. 서명이 끝난 계약서에는 전체 번호가 기재돼요.
                  </span>
                </p>
                <TextInput
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={IDENTITY_DIGITS}
                  value={identityDigits}
                  onChange={(e) => setIdentityDigits(e.target.value.replace(/\D/g, '').slice(0, IDENTITY_DIGITS))}
                  placeholder={'0'.repeat(IDENTITY_DIGITS)}
                  aria-label={`연락처 뒤 ${IDENTITY_DIGITS}자리`}
                  light
                  className="w-32 text-center tracking-[0.4em] text-lg px-4 py-3 [color-scheme:light]"
                />
                </>
                )}
                <label className="mt-5 flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={identityConfirmed}
                    onChange={(e) => setIdentityConfirmed(e.target.checked)}
                  />
                  <span className="text-gray-700 dark:text-gray-700">
                    본인이 계약 당사자임을 확인하며, 위 계약 내용을 모두 읽고 이해했어요. 아래 <strong>전자서명</strong>이 자필
                    서명과 같은 효력을 가지는 데 동의해요.
                  </span>
                </label>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">전자서명</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">아래 영역에 마우스나 손가락으로 서명해 주세요.</p>
                <SignaturePad ref={signaturePadRef} onSignedChange={setHasSigned} />
              </div>

              {submitError && (
                <Notice tone="error" light className="mt-6">
                  {submitError}
                </Notice>
              )}

              <div className="mt-8">
                <Button light size="lg" fullWidth disabled={submitting || !ready} onClick={handleSubmit}>
                  {submitting ? '처리 중...' : '계약서 서명 완료'}
                </Button>
                {!submitting && !ready && (
                  <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-500">{pendingHint}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// 디자인 판 — lib/designEdition.ts
ProductionContractSignPage.designEdition = 'v2';
