import ContractNotice from '../../../../components/contracts/ContractNotice';
import ContractSignNav, { SIGNATURE_SECTION_ID } from '../../../../components/contracts/ContractSignNav';
import { focusFirstMissing, MISSING_RING, type MissingItem } from '../../../../components/contracts/missingGuide';
import { withI18nServerProps } from '../../../../lib/getStatic';
import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Markdown from 'markdown-to-jsx';

import ContractContent from '../../../../components/contracts/ContractContent';
import { SignaturePad, type SignaturePadHandle } from '../../../../components/contracts/SignaturePad';
import { Button } from '../../../../components/ui/Button';
import { Field, TextInput } from '../../../../components/ui/Field';
import { lightOnlyField } from '../../../../components/ui/adminFieldClass';
import { getDb } from '../../../../db/client';
import {
  serializeAttachment,
  serializeClause,
  type SerializedAttachment,
  type SerializedClause,
  type SerializedContract,
} from '../../../../lib/contracts/serialize';
import { IDENTITY_DIGITS, maskIdentityDigitsInContent } from '../../../../lib/contracts/identity';
import { birthdateErrorMessage, formatBirthdateInput, isUnder19, parseBirthdate } from '../../../../lib/contracts/birthdate';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { CONTRACT_MARKDOWN_OPTIONS } from '../../../../lib/contracts/html-escape';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { expireOverdueContracts } from '../../../../lib/contracts/service';
import { getEffectiveStatus } from '../../../../lib/contracts/status';
import { clearDraft, readDraft, writeDraft } from '../../../../lib/contracts/sign-draft';
import { resolveRulesContent } from '../../../../lib/contracts/template';
import { recordContractView } from '../../../../lib/contracts/view-log';
import { Notice } from '../../../../components/ui/Notice';

type UnavailableReason =
  | 'expired'
  | 'cancelled'
  /** 재발송 등으로 이 링크가 무효가 됐다 — 계약 자체는 살아 있을 수 있다. */
  | 'superseded';

/**
 * 서명 화면이 그리는 계약 값. 행 전체(SerializedContract)를 넘기지 않는다 —
 * getServerSideProps가 돌려주는 props는 __NEXT_DATA__로 HTML에 그대로 실린다.
 */
type SignPageContract = Pick<SerializedContract, 'id' | 'title' | 'customerName' | 'content'>;

interface SignPageProps {
  locale: string;
  token: string;
  contract: SignPageContract | null;
  clauses: SerializedClause[];
  attachments: SerializedAttachment[];
  rulesContent: string;
  unavailable?: UnavailableReason;
  error?: string;
}

export const getServerSideProps = withI18nServerProps<SignPageProps>(async (context) => {
  // 계약 본문은 개인정보다. 공유 캐시 지시자를 먼저 걷어낸다(page-cache.ts 주석 참조).
  denyContractPageCaching(context.res);

  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;

  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  const empty = { locale, token, contract: null, clauses: [], attachments: [], rulesContent: '' };

  try {
    // 접근 시점에 만료를 판정한다(크론 없는 lazy 방식).
    await expireOverdueContracts();

    const contract = await getDb().query.contracts.findFirst({
      where: (contracts, { eq, and }) => and(eq(contracts.id, id), eq(contracts.signToken, token)),
      with: { contractClauses: true, contractAttachments: true },
    });

    if (!contract) {
      /**
       * 사이트 공용 404를 띄우지 않는다.
       *
       * 여기 오는 사람은 대부분 재발송으로 무효가 된 옛 링크를 누른 계약 당사자다.
       * "페이지를 찾을 수 없습니다"를 보면 자기가 잘못한 줄 알고 헤매게 된다.
       * 무엇이 일어났고 무엇을 하면 되는지 계약 맥락으로 알려 준다.
       */
      return {
        props: {
          ...empty,
          unavailable: 'superseded',
        },
      };
    }

    const status = getEffectiveStatus(contract);

    /**
     * 서명을 마친 문서는 이용이 끝났어도(terminated) 완료 화면이 연다. 완료 화면은 이름·호실·
     * 기간·월세만 싣고, 생년월일·주소가 든 서명본은 연락처 뒷자리를 확인한 뒤에만 내려 준다.
     * terminated가 이 분기에 없던 동안에는 아래 서명 화면으로 떨어져, 링크만 가진 사람에게
     * 서명자의 생년월일·주소·이메일이 확인 없이 실렸다. 이용 종료는 모든 계약의 정상 결말이다.
     */
    if (status === 'signed' || status === 'terminated') {
      return {
        redirect: {
          destination: `/${locale}/contracts/${id}/complete?token=${encodeURIComponent(token)}`,
          permanent: false,
        },
      };
    }

    /**
     * 서명 화면은 서명 대기(sent) 계약에만 연다. 막을 상태를 나열하지 않고 sent만 통과시켜,
     * 상태가 새로 생겨도 서명 화면으로 떨어지지 않게 한다.
     */
    if (status !== 'sent') {
      // draft는 아직 발송 전이라 고객에게 링크가 노출될 일이 없다. 만료와 같이 안내한다.
      return {
        props: {
          ...empty,
          unavailable: status === 'cancelled' ? 'cancelled' : 'expired',
        },
      };
    }

    /**
     * 여기까지 왔으면 서명 대기 중인 계약을 실제로 연 것이다. 그 사실을 남긴다.
     *
     * 상태 판정 뒤에 두는 이유: 만료·취소·이미 서명된 계약의 접속까지 세면 "몇 번 열어
     * 봤는가"가 흐려진다. 기록에 실패해도 계약서는 그대로 보여준다(view-log.ts 주석).
     */
    await recordContractView(contract.id, token, getClientIp(context.req));

    const { contractClauses, contractAttachments } = contract;

    return {
      props: {
        locale,
        token,
        /**
         * 화면이 그리는 값만 싣는다(완료 페이지와 같은 원칙). 행을 통째로 넘기면 이메일·
         * 열람 IP·발송 오류 같은 값까지 __NEXT_DATA__로 HTML에 실린다.
         *
         * 연락처는 본인 확인의 정답이라 싣지 않고, 본문에 적힌 것도 가린다. 같은 페이지에
         * 답이 남아 있으면 본인 확인이 무의미하다.
         */
        contract: {
          id: contract.id,
          title: contract.title,
          customerName: contract.customerName,
          content: maskIdentityDigitsInContent(contract.content, contract.customerPhone),
        },
        clauses: contractClauses.map(serializeClause),
        attachments: contractAttachments.map(serializeAttachment),
        rulesContent: resolveRulesContent(contractAttachments),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/[id]/sign] Failed to load contract:', error);
    // DB 장애다 — 링크가 잘못된 것이 아니므로 '찾을 수 없다'고 말하면 안 된다.
    // 고객이 링크를 의심하며 헤매지 않도록 다시 시도할 일이라고 알린다.
    return {
      props: {
        ...empty,
        error:
          '지금 계약서를 불러올 수 없습니다. 잠시 후 링크를 다시 열어 주세요. 계속 안 되면 010-4255-7893으로 연락해 주세요.',
      },
    };
  }
});



/** 계약서 페이지는 종이처럼 항상 밝다 — 컨트롤은 `light` prop, 래퍼는 이 클래스로 되돌린다. */
const LIGHT_FIELD = lightOnlyField;

export default function ContractSignPage({
  locale,
  token,
  contract,
  clauses,
  attachments,
  rulesContent,
  unavailable,
  error,
}: SignPageProps) {
  const router = useRouter();
  const signaturePadRef = useRef<SignaturePadHandle>(null);

  const [hasSigned, setHasSigned] = useState(false);
  const [customerBirthdate, setCustomerBirthdate] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [identityDigits, setIdentityDigits] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [agreements, setAgreements] = useState<Record<string, boolean>>({});
  const [showRules, setShowRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 서명 버튼을 눌렀는데 빠진 게 있으면 켠다 — 그때부터 빠진 칸을 빨갛게 표시한다(components/contracts/missingGuide.ts).
  const [showMissing, setShowMissing] = useState(false);

  const allAgreed =
    contract !== null &&
    clauses.every((clause) => agreements[clause.id]) &&
    attachments.every((attachment) => agreements[attachment.id]);

  const identityReady = identityDigits.length === IDENTITY_DIGITS && identityConfirmed;
  // 생년월일은 숫자 8자리를 치면 `YYYY-MM-DD`로 정리되는 글자 칸이다(lib/contracts/birthdate.ts). 서버가 받는 값은 그대로 이 형식.
  const birthdateParse = parseBirthdate(customerBirthdate);
  const under19 = isUnder19(customerBirthdate);
  const detailsReady = birthdateParse.ok && customerAddress.trim() !== '';
  /** 칸을 고치면 그 칸의 서버 오류를 지운다 — 고친 뒤에도 옛 오류가 남아 있으면 무엇이 틀렸는지 헷갈린다. */
  const clearFieldError = (field: string) =>
    setDetailErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  /** 빠진 항목 — 화면 위에서 아래 순서. */
  const missing: MissingItem[] = [
    ...(!birthdateParse.ok ? [{ id: 'customerBirthdate', label: '생년월일' }] : []),
    ...(!customerAddress.trim() ? [{ id: 'customerAddress', label: '주소' }] : []),
    ...clauses.filter((clause) => !agreements[clause.id]).map((clause) => ({ id: `clause-${clause.id}`, label: `${clause.clauseNumber} 동의 체크` })),
    ...attachments.filter((a) => !agreements[a.id]).map((a) => ({ id: `attachment-${a.id}`, label: `「${a.title}」 동의 체크` })),
    ...(identityDigits.length !== IDENTITY_DIGITS ? [{ id: 'identityDigits', label: `연락처 뒤 ${IDENTITY_DIGITS}자리` }] : []),
    ...(!identityConfirmed ? [{ id: 'identity-confirmed', label: '본인 확인 체크' }] : []),
    ...(!hasSigned ? [{ id: 'signature-pad', label: '서명' }] : []),
  ];
  const isMissing = (id: string) => showMissing && missing.some((item) => item.id === id);

  /**
   * 입력하던 값을 되살린다.
   *
   * 렌더가 아니라 마운트 후에 읽는다 — 서버에는 sessionStorage가 없어, 초기값으로 쓰면
   * 서버가 그린 빈 칸과 하이드레이션 결과가 어긋난다.
   */
  useEffect(() => {
    if (!contract) return;
    const draft = readDraft(contract.id);
    if (draft.customerBirthdate) setCustomerBirthdate(formatBirthdateInput(draft.customerBirthdate));
    if (draft.customerAddress) setCustomerAddress(draft.customerAddress);
  }, [contract]);

  /** 값이 바뀔 때마다 덮어쓴다. 둘 다 비면 남겨 둘 이유가 없으니 지운다. */
  useEffect(() => {
    if (!contract) return;
    if (customerBirthdate === '' && customerAddress === '') {
      clearDraft(contract.id);
      return;
    }
    writeDraft(contract.id, { customerBirthdate, customerAddress });
  }, [contract, customerBirthdate, customerAddress]);

  const handleSubmit = async () => {
    if (!contract) return;
    if (!detailsReady) {
      setSubmitError('생년월일과 주소를 입력해 주세요. 계약서에 그대로 기재됩니다.');
      return;
    }
    if (!allAgreed) {
      setSubmitError('모든 동의 항목을 확인해 주세요.');
      return;
    }
    if (!identityReady) {
      setSubmitError(
        identityDigits.length !== IDENTITY_DIGITS
          ? `연락처 뒤 ${IDENTITY_DIGITS}자리를 입력해 주세요.`
          : '본인 확인 및 전자서명 방식 동의에 체크해 주세요.',
      );
      return;
    }
    if (!hasSigned) {
      setSubmitError('서명을 완료해 주세요.');
      return;
    }

    const signatureData = signaturePadRef.current?.toDataURL();
    if (!signatureData) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureData,
          agreements: [...clauses.map((c) => c.id), ...attachments.map((a) => a.id)],
          identityDigits,
          identityConfirmed,
          customerBirthdate: birthdateParse.ok ? birthdateParse.value : '',
          customerAddress: customerAddress.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      /**
       * 이미 서명이 끝난 계약이면 오류가 아니다.
       *
       * 응답을 받기 전에 연결이 끊기면 화면에는 실패로 보이는데 서버에서는 서명이 확정된
       * 상태가 된다. 고객이 버튼을 다시 누르면 "서명완료 상태의 계약은 서명할 수 없습니다"
       * 같은 관리자용 문구를 보게 되고, 정작 자기 계약서를 받을 길은 화면에 없다.
       * 결과가 이미 서명 완료라면 완료 화면으로 보내는 것이 사실에 맞다.
       */
      if (response.status === 409 && result.status === 'signed') {
        clearDraft(contract.id);
        await router.push(
          `/${locale}/contracts/${contract.id}/complete?token=${encodeURIComponent(token)}`,
        );
        return;
      }

      if (!response.ok || !result.ok) {
        // 항목별 오류는 해당 입력칸 아래에 붙인다 — 어디를 고쳐야 하는지 바로 보여야 한다.
        if (Array.isArray(result.errors)) {
          const map: Record<string, string> = {};
          for (const item of result.errors) {
            if (item && typeof item.field === 'string' && typeof item.message === 'string') {
              map[item.field] = item.message;
            }
          }
          setDetailErrors(map);
          // 서버가 짚은 칸 중 화면 위쪽 첫 칸으로 옮기고 커서를 둔다(버튼 근처에서는 어느 칸이 틀렸는지 안 보인다).
          const failed = ['customerBirthdate', 'customerAddress'].filter((field) => field in map);
          if (failed.length > 0) window.setTimeout(() => focusFirstMissing(failed.map((id) => ({ id, label: id }))), 0);
        }
        throw new Error(result.message || '서명 제출에 실패했습니다.');
      }

      setDetailErrors({});
      // 서명이 확정됐으니 임시 저장본은 쓸모가 없다. 같은 탭에 남겨 둘 이유가 없다.
      clearDraft(contract.id);

      await router.push(
        `/${locale}/contracts/${contract.id}/complete?token=${encodeURIComponent(token)}`,
      );
    } catch (err: unknown) {
      /**
       * 네트워크가 끊긴 경우 브라우저는 "Failed to fetch"(사파리는 "Load failed")를 준다.
       * 그 말을 그대로 보여 주면 고객은 무엇을 해야 할지 알 수 없고, 서명이 접수됐는지조차
       * 모른다. 실제로 접수된 경우가 있으므로 다시 눌러 보라고 안내한다.
       */
      const isNetworkError = err instanceof TypeError;
      setSubmitError(
        isNetworkError
          ? '제출 결과를 확인하지 못했습니다. 연결을 확인한 뒤 아래 버튼을 다시 눌러 주세요. 이미 접수되었다면 완료 화면으로 이동합니다.'
          : err instanceof Error
            ? err.message
            : '서명 제출 중 오류가 발생했습니다.',
      );
      setSubmitting(false);
    }
  };

  if (unavailable === 'expired') {
    return (
      <>
        <Head>
          <title>서명 링크 만료 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title="서명 링크가 만료되었습니다"
          description="보안을 위해 서명 링크는 일정 기간이 지나면 사용할 수 없습니다. 운영자에게 재발송을 요청해 주세요."
        />
      </>
    );
  }

  if (unavailable === 'superseded') {
    return (
      <>
        <Head>
          <title>사용할 수 없는 링크 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title="이 서명 링크는 더 이상 사용할 수 없습니다"
          description="계약서를 다시 보내 드렸다면 가장 최근에 받으신 메일의 링크를 열어 주세요. 최근 메일이 없다면 운영자에게 재발송을 요청해 주세요."
        />
      </>
    );
  }

  if (unavailable === 'cancelled') {
    return (
      <>
        <Head>
          <title>취소된 계약 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title="취소된 계약입니다"
          description="이 계약은 운영자가 취소했습니다. 내용이 맞지 않는다면 스튜디오로 문의해 주세요."
        />
      </>
    );
  }

  if (error || !contract) {
    // 장애로 못 읽은 것과 링크가 잘못된 것은 고객이 할 일이 다르다. 제목부터 구분한다.
    const title = error ? '계약서를 여는 중 문제가 생겼습니다' : '계약서를 찾을 수 없습니다';

    return (
      <>
        <Head>
          <title>{title} | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title={title}
          description={error || '잘못된 링크입니다. 메일에 포함된 링크를 다시 확인해 주세요.'}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{contract.title} — 서명 요청 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* URL에 서명 토큰이 들어 있다. 계약 본문·이용수칙은 사람이 고치는 마크다운이라
            나중에 외부 링크가 들어가면 Referer로 토큰이 조용히 샌다. 미리 막는다. */}
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 [color-scheme:light] py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white dark:bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-primary p-6 md:p-8">
              {/* 어디서 온 문서인지 먼저 밝힌다. 메일 링크로 들어온 사람이 피싱과 구별할
                  근거이고, 사이트 헤더를 붙이지 않으므로 여기가 유일한 자리다. */}
              <p className="text-white/70 dark:text-white/70 text-sm font-medium mb-1">
                스튜디오 놀 · 서울 은평구 대조동
              </p>
              <h1 className="typo-page-title text-white dark:text-white">음악연습실 이용계약서</h1>
              <p className="text-white dark:text-white/80 mt-2">
                {contract.customerName}님, 아래 내용을 확인하고 서명해 주세요.
              </p>
            </div>

            <div className="p-4 sm:p-6 md:p-10">
              <ContractSignNav content={contract.content} formal />

              <ContractContent content={contract.content} />

              {rulesContent && (
                <div className="mt-8 border border-gray-200 dark:border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={showRules}
                    aria-controls="house-rules-panel"
                    onClick={() => setShowRules((prev) => !prev)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-900">
                      첨부 「공동생활 이용수칙」 {showRules ? '접기' : '펼쳐 보기'}
                    </span>
                    <span aria-hidden="true" className="text-gray-400 dark:text-gray-400">
                      {showRules ? '−' : '+'}
                    </span>
                  </button>
                  {showRules && (
                    <div id="house-rules-panel" className="px-5 py-4 prose prose-sm max-w-none prose-headings:font-bold">
                      <Markdown options={CONTRACT_MARKDOWN_OPTIONS}>{rulesContent}</Markdown>
                    </div>
                  )}
                </div>
              )}

              {/*
                당사자만 아는 정보는 당사자가 적는다.

                운영자는 생년월일·주소를 알 수 없다. 대신 적으면 오타가 나도 확인할 방법이
                없고, 계약 당사자를 특정하는 정보라 잘못 적히면 문서 자체가 흔들린다.
                여기서 채운 값으로 위 계약서가 완성된 뒤 그 최종본에 서명이 붙는다.
              */}
              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">이용자 정보</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4 leading-relaxed">
                  아래 두 항목은 계약서에 그대로 기재됩니다. 정확히 입력해 주세요.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    id="customerBirthdate"
                    label="생년월일"
                    required
                    hint="숫자 8자리로 적습니다. 예: 19900115"
                    error={detailErrors.customerBirthdate ?? birthdateErrorMessage(birthdateParse, isMissing('customerBirthdate'))}
                    className={LIGHT_FIELD}
                  >
                    <TextInput
                      type="text"
                      inputMode="numeric"
                      value={customerBirthdate}
                      onChange={(e) => {
                        setCustomerBirthdate(formatBirthdateInput(e.target.value));
                        clearFieldError('customerBirthdate');
                      }}
                      maxLength={10}
                      placeholder="예: 19900115"
                      autoComplete="bday"
                      light
                      className="px-4 py-3"
                    />
                  </Field>

                  {under19 && (
                    <Notice tone="warning" light className="md:col-span-2">
                      만 19세 미만은 온라인으로 계약할 수 없습니다. 010-4255-7893으로 문의해 주세요.
                    </Notice>
                  )}

                  <Field
                    id="customerAddress"
                    label="주소"
                    required
                    error={detailErrors.customerAddress ?? (isMissing('customerAddress') ? '입력해 주세요.' : undefined)}
                    className={LIGHT_FIELD}
                  >
                    <TextInput
                      value={customerAddress}
                      onChange={(e) => {
                        setCustomerAddress(e.target.value);
                        clearFieldError('customerAddress');
                      }}
                      placeholder="예: 서울시 은평구 대조동 00-0"
                      autoComplete="street-address"
                      light
                      className="px-4 py-3"
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-4">필수 동의</h2>

                <div className="space-y-3">
                  {clauses.map((clause) => (
                    <label
                      key={clause.id}
                      id={`clause-${clause.id}`}
                      className={`flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 ${isMissing(`clause-${clause.id}`) ? MISSING_RING : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 focus-visible:ring-offset-white"
                        checked={agreements[clause.id] || false}
                        onChange={(e) =>
                          setAgreements((prev) => ({ ...prev, [clause.id]: e.target.checked }))
                        }
                      />
                      <span className="text-gray-700 dark:text-gray-700">
                        <span className="font-semibold">{clause.clauseNumber}</span> {clause.title}
                        에 동의합니다.
                      </span>
                    </label>
                  ))}

                  {attachments.map((attachment) => (
                    <label
                      key={attachment.id}
                      id={`attachment-${attachment.id}`}
                      className={`flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 ${isMissing(`attachment-${attachment.id}`) ? MISSING_RING : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 focus-visible:ring-offset-white"
                        checked={agreements[attachment.id] || false}
                        onChange={(e) =>
                          setAgreements((prev) => ({ ...prev, [attachment.id]: e.target.checked }))
                        }
                      />
                      <span className="text-gray-700 dark:text-gray-700">
                        「{attachment.title}」을 읽고 동의합니다.
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">본인 확인</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  계약 체결 시 등록하신 연락처의 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.
                  <span className="block mt-1 text-gray-500 dark:text-gray-500">
                    본인 확인을 위해 위 계약서에서는 이 자리를 가려 두었습니다. 서명이 끝난
                    계약서에는 전체 번호가 기재됩니다.
                  </span>
                </p>

                <TextInput
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={IDENTITY_DIGITS}
                  value={identityDigits}
                  onChange={(e) =>
                    setIdentityDigits(e.target.value.replace(/\D/g, '').slice(0, IDENTITY_DIGITS))
                  }
                  placeholder={'0'.repeat(IDENTITY_DIGITS)}
                  aria-label={`연락처 뒤 ${IDENTITY_DIGITS}자리`}
                  id="identityDigits"
                  invalid={isMissing('identityDigits') || undefined}
                  light
                  className="w-32 text-center tracking-[0.4em] text-lg px-4 py-3 [color-scheme:light]"
                />

                <label
                  id="identity-confirmed"
                  className={`mt-5 flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 ${isMissing('identity-confirmed') ? MISSING_RING : ''}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 focus-visible:ring-offset-white"
                    checked={identityConfirmed}
                    onChange={(e) => setIdentityConfirmed(e.target.checked)}
                  />
                  <span className="text-gray-700 dark:text-gray-700">
                    본인이 계약 당사자임을 확인하며, 위 계약 내용을 모두 읽고 이해했습니다.
                    아래 <strong>전자서명</strong>이 자필 서명과 같은 효력을 가지는 데 동의합니다.
                  </span>
                </label>
              </div>

              <div id={SIGNATURE_SECTION_ID} className="mt-10 border-t border-gray-200 dark:border-gray-200 pt-8">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-gray-900 mb-2">전자서명</h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  아래 영역에 마우스나 손가락으로 서명해 주세요.
                </p>

                <div id="signature-pad" tabIndex={-1} className={`rounded-xl focus:outline-none ${isMissing('signature-pad') ? MISSING_RING : ''}`}>
                  <SignaturePad ref={signaturePadRef} onSignedChange={setHasSigned} />
                </div>
              </div>

              {submitError && (
                <Notice tone="error" light className="mt-6">
                  {submitError}
                </Notice>
              )}

              <div className="mt-8">
                {/* 버튼은 늘 눌린다 — 빠진 게 있으면 그 자리로 옮기고 표시한다(missingGuide.ts). */}
                {showMissing && missing.length > 0 && (
                  <p role="alert" className="mb-3 text-center text-sm font-medium text-red-600 dark:text-red-600">
                    아직 남은 항목: {missing.map((item) => item.label).join(', ')}
                  </p>
                )}
                <Button light
                  size="lg"
                  fullWidth
                  disabled={submitting}
                  onClick={() => {
                    if (missing.length > 0) {
                      setShowMissing(true);
                      focusFirstMissing(missing);
                      return;
                    }
                    void handleSubmit();
                  }}
                >
                  {submitting ? '처리 중...' : '계약서 서명 완료'}
                </Button>
                {!submitting && !showMissing && (!detailsReady || !allAgreed || !identityReady || !hasSigned) && (
                  <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-500">
                    {!detailsReady
                      ? '생년월일과 주소를 입력해 주세요.'
                      : !allAgreed
                        ? '모든 동의 항목에 체크해 주세요.'
                        : !identityReady
                          ? '본인 확인을 완료해 주세요.'
                          : '서명을 입력해 주세요.'}
                  </p>
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
ContractSignPage.designEdition = 'v2';
