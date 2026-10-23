import React from 'react';
import Head from 'next/head';

import ContractNotice from '../../../../../components/contracts/ContractNotice';
import ContractPdfDownload from '../../../../../components/contracts/ContractPdfDownload';
import { Button } from '../../../../../components/ui/Button';
import { getDb } from '../../../../../db/client';
import { formatCurrency, formatDate } from '../../../../../lib/contracts/format';
import { IDENTITY_DIGITS } from '../../../../../lib/contracts/identity';
import { denyContractPageCaching } from '../../../../../lib/contracts/page-cache';
import { completeStalledProductionContract } from '../../../../../lib/contracts/production/finalize';
import { productionProgressPath, productionSignPath } from '../../../../../lib/contracts/production/links';
import { getEffectiveProductionStatus, hasSignedDocument } from '../../../../../lib/contracts/production/status';
import { maskEmail } from '../../../../../lib/contracts/production/open-link';
import { ensureContractPaymentLink } from '../../../../../lib/contracts/production/payment-link';
import { loadProgressContext } from '../../../../../lib/contracts/production/progress';
import { contractNameFor, depositWordFor, isOneSongKind, parseStoredTerms, paymentPurposeWord, releaseTitle } from '../../../../../lib/contracts/production/terms';
import { withI18nServerProps } from '../../../../../lib/getStatic';

/**
 * 화면이 그리는 값만 싣는다. 생년월일·주소·연락처가 든 서명본은 연락처 뒷자리를 확인한 뒤 PDF로만 준다
 * (연습실 complete.tsx와 같은 원칙 — props는 HTML에 그대로 실린다).
 */
interface CompleteViewContract {
  clientName: string;
  /** 발매물 이름(싱글은 곡 제목, EP·정규는 음반 제목과 곡 수). */
  releaseLabel: string;
  isSingle: boolean;
  /** "음원 제작 용역 계약" 또는 "믹싱·마스터링 용역 계약". */
  contractName: string;
  /** "계약금" 또는(50만원 이하 일시불) "대금". */
  depositWord: string;
  /** 서명본을 보낸 이메일(가린 값) — 링크 계약은 의뢰인이 서명 때 적은 주소라, 틀렸으면 바로 알아채게 보인다. */
  maskedEmail: string;
  /** 링크 계약으로 서명했는가(연락처 대조 없음) — 내려받기 안내를 "서명할 때 적으신 번호"로 바꾼다. */
  openLinkSigned: boolean;
  total: number;
  deposit: number;
  depositDueDays: number;
  account: string;
  signedAt: string | null;
}

interface CompletePageProps {
  locale: string;
  contract: CompleteViewContract | null;
  downloadUrl: string;
  /** 진행 페이지 주소(토큰 포함). 파기된 계약은 빈 문자열. */
  progressPath: string;
  /** 지금 받을 돈의 결제 페이지(payment-link.ts) — 의뢰인 링크·진행 중 계약에만. 없으면 계좌 안내만. */
  payment: { url: string; amount: number; label: string } | null;
  /** 계약금(일시불이면 대금)을 이미 받았는가 — 받았으면 입금 안내를 보이지 않는다. */
  depositPaid: boolean;
  purged: boolean;
  unavailable?: 'not-found' | 'error';
  /** 진행이 끝난 계약 — 서명본은 그대로 받을 수 있다. */
  closed?: 'completed' | 'terminated';
  /** 이 사람은 서명했고, 다른 당사자(의뢰인·법정대리인)의 서명을 기다린다 — 아직 계약 전이다. */
  waitingFor?: string;
  /** 상대 서명 기한이 지났다 — 내 서명은 남아 있고, 스튜디오가 상대에게 다시 보내면 이어서 체결된다. */
  waitingExpired?: boolean;
}

const OPERATOR_PHONE = '010-4255-7893';

export const getServerSideProps = withI18nServerProps<CompletePageProps>(async (context) => {
  denyContractPageCaching(context.res);

  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;
  const empty = { locale, contract: null, downloadUrl: '', progressPath: '', payment: null, depositPaid: false, purged: false };

  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { props: { ...empty, unavailable: 'not-found' as const } };
  }

  try {
    const load = () =>
      getDb().query.productionContracts.findFirst({ where: (t, { eq }) => eq(t.id, id), with: { signers: true } });
    let contract = await load();
    // 서명은 모두 끝났는데 성립에서 멈춘 계약(서명 직후 오류)은 여기서 마저 끝낸다.
    if (contract?.signers.some((signer) => signer.signToken === token) && (await completeStalledProductionContract(contract))) {
      contract = await load();
    }
    const linkSigner = contract?.signers.find(
      (signer) => (signer.role === 'client' || signer.role === 'guardian') && signer.signToken === token,
    );
    // 토큰 불일치와 부재를 같은 화면으로 묶는다 — 어느 쪽인지 알려 주면 계약 id의 존재가 새어 나간다.
    if (!contract || !linkSigner) {
      return { props: { ...empty, unavailable: 'not-found' as const } };
    }

    const status = getEffectiveProductionStatus(contract);
    // 내 서명은 끝났고 상대 서명을 기다린다 — 계약 정보는 싣지 않고 그 사실만 알린다.
    // 상대가 기한 안에 서명하지 않아 만료로 보이는 때도 같다 — 내 서명은 끝났으니 "링크 만료"를 보일 사람이 아니다.
    if ((status === 'sent' || status === 'expired') && linkSigner.status === 'signed') {
      const other = contract.signers.find((signer) => signer.status === 'pending' && signer.role !== 'operator');
      // 모두 서명했는데 체결 처리만 남은 계약(성립 단계가 다시 실패한 드문 경우) — 기다릴 서명자가 없다.
      if (!other) return { props: { ...empty, unavailable: 'error' as const } };
      return {
        props: { ...empty, waitingFor: other.role === 'guardian' ? '법정대리인' : '의뢰인', waitingExpired: status === 'expired' },
      };
    }
    // 서명 전이면 아무것도 싣지 않고 서명 화면으로 보낸다(반대 방향은 sign.tsx가 맡는다).
    if (!hasSignedDocument(status)) {
      return { redirect: { destination: productionSignPath(id, token, locale), permanent: false } };
    }

    const terms = parseStoredTerms(contract.termsJson);
    // 결제 페이지는 의뢰인에게만(법정대리인 화면에는 두지 않는다) — 진행 중 계약이면 지금 받을 돈의 링크를 연다.
    const payLink =
      linkSigner.role === 'client' && status === 'signed' && !contract.purgedAt ? await ensureContractPaymentLink(contract.id) : null;
    const depositPaid = Boolean((await loadProgressContext(contract.id))?.ledger.payments.depositMetAt);
    return {
      props: {
        locale,
        depositPaid,
        payment: payLink
          ? { url: payLink.url, amount: payLink.amount, label: paymentPurposeWord(payLink.purpose, terms) }
          : null,
        contract: {
          clientName: contract.clientName,
          releaseLabel: releaseTitle(contract.kind, terms),
          isSingle: isOneSongKind(contract.kind),
          contractName: contractNameFor(contract.kind).replace(/서$/, ''),
          depositWord: depositWordFor(terms),
          // 이 링크의 서명자에게 간 주소 — 법정대리인 링크면 대리인 주소다.
          maskedEmail: maskEmail(linkSigner.role === 'guardian' ? linkSigner.email : contract.clientEmail),
          openLinkSigned: linkSigner.role === 'client' && linkSigner.identityVerifiedAt === null,
          total: terms.amount.total,
          deposit: terms.amount.deposit,
          depositDueDays: terms.amount.depositDueDays,
          account: `${terms.payment.bank} ${terms.payment.account} (예금주 ${terms.payment.holder})`,
          signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
        },
        downloadUrl: `/api/contracts/production/${contract.id}/download?token=${encodeURIComponent(token)}`,
        // 진행 페이지는 의뢰인 링크로만 연다(승인·수정 요청은 의뢰인의 행위다).
        progressPath: contract.purgedAt || linkSigner.role !== 'client' ? '' : productionProgressPath(contract.id, token, locale),
        purged: contract.purgedAt !== null,
        ...(status === 'completed' || status === 'terminated' ? { closed: status } : {}),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/production/[id]/complete] Failed to load contract:', error);
    return { props: { ...empty, unavailable: 'error' as const } };
  }
});

export default function ProductionContractCompletePage({
  locale,
  contract,
  downloadUrl,
  progressPath,
  payment,
  depositPaid,
  purged,
  unavailable,
  closed,
  waitingFor,
  waitingExpired,
}: CompletePageProps) {
  if (waitingFor) {
    return (
      <>
        <Head>
          <title>서명 완료 | Studio NOL</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title="서명이 접수됐어요"
          description={
            waitingExpired
              ? `${waitingFor}의 서명 기한이 지났어요. 스튜디오가 ${waitingFor}에게 서명 링크를 다시 보내면 이어서 계약이 체결돼요. 문의 ${OPERATOR_PHONE}`
              : `${waitingFor}의 서명까지 끝나면 계약이 체결되고, 서명본 PDF를 메일로 보내 드려요.`
          }
        />
      </>
    );
  }

  if (unavailable || !contract) {
    const isError = unavailable === 'error';
    const title = isError ? '계약서를 여는 중 문제가 생겼습니다' : '계약서를 찾을 수 없습니다';
    return (
      <>
        <Head>
          <title>{`${title} | Studio NOL`}</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title={title}
          description={
            isError
              ? '잠시 후 다시 시도해 주세요. 서명은 이미 접수되었을 수 있으니, 계속 같은 화면이 나오면 아래 번호로 알려 주세요.'
              : '링크가 만료되었거나 주소가 잘못되었습니다. 메일이나 카카오톡으로 받은 링크를 다시 확인해 주세요.'
          }
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>계약 체결 완료 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 [color-scheme:light] flex items-center justify-center px-4 py-12">
        <div className="bg-white dark:bg-white rounded-2xl shadow-sm p-8 md:p-12 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600 dark:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <p className="text-gray-400 dark:text-gray-400 text-sm font-medium mb-2">스튜디오 놀</p>
          <h1 className="typo-page-title text-gray-900 dark:text-gray-900 mb-3">계약 체결 완료</h1>
          <p className="text-gray-600 dark:text-gray-600 mb-8 leading-relaxed">
            <span className="block">
              {purged ? '체결이 완료된 계약입니다.' : `${contract.clientName}님, ${contract.contractName}이 체결되었어요.`}
            </span>
            <span className="block">
              {purged ? (
                '보관 기간이 지나 개인정보를 파기했어요.'
              ) : (
                <>
                  서명본 PDF와 입금 안내를 <strong>{contract.maskedEmail}</strong>(으)로 보내 드려요.
                  <span className="block mt-1 text-gray-500 dark:text-gray-500">주소가 틀렸다면 바로 {OPERATOR_PHONE}으로 알려 주세요.</span>
                </>
              )}
            </span>
          </p>

          {closed && (
            <p className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-200 dark:bg-gray-50 dark:text-gray-700">
              이 계약은 <strong>{closed === 'completed' ? '작업이 완료' : '해지'}</strong>되었어요. 서명본은 그대로 보관되며 아래에서
              내려받을 수 있어요.
            </p>
          )}

          <div className="bg-gray-50 dark:bg-gray-50 rounded-xl p-6 text-left mb-8">
            <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <dt className="text-gray-500 dark:text-gray-500">{contract.isSingle ? '본 곡' : '음반'}</dt>
              <dd className="text-gray-900 dark:text-gray-900 font-medium text-right">{contract.releaseLabel}</dd>
              <dt className="text-gray-500 dark:text-gray-500">계약금액</dt>
              <dd className="text-gray-900 dark:text-gray-900 font-medium text-right">{formatCurrency(contract.total)}원</dd>
              <dt className="text-gray-500 dark:text-gray-500">체결일</dt>
              <dd className="text-gray-900 dark:text-gray-900 font-medium text-right">{formatDate(contract.signedAt)}</dd>
            </dl>
            {!closed && !purged && payment && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-200 text-sm text-gray-700 dark:text-gray-700 leading-relaxed">
                <p>
                  {payment.label} <strong>{formatCurrency(payment.amount)}원</strong>을 체결일로부터 {contract.depositDueDays}일 이내에
                  결제해 주세요. 카드·간편결제·계좌 입금 중에서 고를 수 있어요.
                </p>
                <Button asChild className="mt-3 w-full">
                  <a href={payment.url}>{payment.label} {formatCurrency(payment.amount)}원 결제하기</a>
                </Button>
                <span className="block mt-2 text-gray-500 dark:text-gray-500">계좌로 직접 보내셔도 돼요: {contract.account}</span>
              </div>
            )}
            {!closed && !purged && !payment && !depositPaid && (
              <p className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-200 text-sm text-gray-700 dark:text-gray-700 leading-relaxed">
                {contract.depositWord} <strong>{formatCurrency(contract.deposit)}원</strong>을 체결일로부터 {contract.depositDueDays}일 이내에
                입금해 주세요.
                <span className="block mt-1 text-gray-500 dark:text-gray-500">{contract.account}</span>
              </p>
            )}
          </div>

          {purged ? (
            <p className="text-sm text-gray-600 dark:text-gray-600 bg-gray-50 dark:bg-gray-50 rounded-xl p-4 mb-6 leading-relaxed">
              <span className="block">보관 기간(3년)이 지나 계약 원본과 개인정보를 파기했어요.</span>
              <span className="block">문의는 {OPERATOR_PHONE}으로 연락해 주세요.</span>
            </p>
          ) : (
            <ContractPdfDownload
              downloadUrl={downloadUrl}
              fileName={`${contract.clientName}_음원제작용역계약서.pdf`}
              labelText={
                <>
                  본인 확인을 위해 {contract.openLinkSigned ? '서명할 때 적으신 휴대폰 번호' : '계약서에 등록된 연락처'} 뒤 {IDENTITY_DIGITS}자리를
                  입력해 주세요.
                </>
              }
            />
          )}

          {progressPath && (
            <Button asChild light size="lg" fullWidth className="mt-6">
              {/* 같은 비공개 경로 안의 이동이라도 문서 이동으로 간다(아래 홈 링크와 같은 이유). */}
              <a href={progressPath} rel="noreferrer">
                작업 진행 보기
              </a>
            </Button>
          )}

          {/* 문서 이동으로 나간다 — 클라이언트 전환이면 토큰이 실린 주소가 측정 스크립트에 page_view로 남는다
              (lib/analytics/privatePaths.ts). */}
          <Button asChild light size="lg" variant="weak" fullWidth className="mt-6">
            <a href={`/${locale}`} rel="noreferrer">
              스튜디오 홈으로
            </a>
          </Button>
        </div>
      </main>
    </>
  );
}

// 디자인 판 — lib/designEdition.ts
ProductionContractCompletePage.designEdition = 'v2';
