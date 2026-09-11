import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import ContractNotice from '../../../../components/contracts/ContractNotice';
import { TextInput } from '../../../../components/ui/Field';
import { Button } from '../../../../components/ui/Button';
import { getDb } from '../../../../db/client';
import { formatDate } from '../../../../lib/contracts/format';
import { IDENTITY_DIGITS } from '../../../../lib/contracts/identity';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { getEffectiveStatus } from '../../../../lib/contracts/status';

/**
 * 이 페이지가 화면에 실제로 그리는 값만 담는다.
 *
 * 계약 레코드를 통째로 넘기면 안 된다. Next.js는 getServerSideProps의 props를
 * __NEXT_DATA__로 HTML에 직렬화하므로, 넘긴 것은 전부 페이지 소스에서 읽힌다.
 * 서명 페이지가 본인 확인을 위해 연락처를 가리는데(sign.tsx의 maskIdentityDigits)
 * 같은 토큰으로 열리는 이 페이지가 원본을 실어 보내면 그 확인이 통째로 무의미해진다.
 *
 * 필드를 골라 담는 방식이라 계약 스키마에 컬럼이 늘어도 여기로 새지 않는다.
 */
interface CompleteViewContract {
  customerName: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  signedAt: string | null;
}

interface CompletePageProps {
  locale: string;
  /** 안내 화면만 띄우는 경우 null. */
  contract: CompleteViewContract | null;
  /** 계약서를 다시 받는 주소. 토큰이 실려 있어 본인만 접근할 수 있다. */
  downloadUrl: string;
  /** 보관 기간이 지나 개인정보가 파기된 계약 — 내려받을 원본이 없다. */
  purged: boolean;
  /**
   * 문서를 보여줄 수 없는 사유. 사이트 공용 404 대신 계약 맥락의 안내를 띄운다 —
   * 여기 오는 사람은 대부분 계약 당사자이고, 링크가 죽은 것과 서버가 흔들린 것은
   * 할 일이 다르다(sign.tsx가 이미 같은 규칙을 쓴다).
   */
  unavailable?: 'not-found' | 'error';
  /** 이용이 종료된 계약. 서명본은 그대로 남으므로 화면은 보여주되 사실을 밝힌다. */
  terminated?: boolean;
}

export const getServerSideProps: GetServerSideProps<CompletePageProps> = async (context) => {
  // 계약 본문은 개인정보다. 공유 캐시 지시자를 먼저 걷어낸다(page-cache.ts 주석 참조).
  denyContractPageCaching(context.res);

  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;

  const empty = { locale, contract: null, downloadUrl: '', purged: false };

  // 토큰을 필수로 요구한다. 없으면 계약 ID만 알아도 이용자의 개인정보를 볼 수 있게 된다.
  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { props: { ...empty, unavailable: 'not-found' as const } };
  }

  try {
    const contract = await getDb().query.contracts.findFirst({
      where: (contracts, { eq, and }) => and(eq(contracts.id, id), eq(contracts.signToken, token)),
    });

    if (!contract) {
      // 토큰 불일치와 부재를 같은 화면으로 묶는 건 의도다 — 어느 쪽인지 알려주면
      // 계약 ID의 존재 여부가 새어 나간다.
      return { props: { ...empty, unavailable: 'not-found' as const } };
    }

    /**
     * 서명 전에는 이 페이지를 열지 않는다 — 서명 페이지가 갈 곳을 안내한다.
     *
     * 화면을 숨기는 것만으로는 부족하다. 렌더 단계에서 분기해도 props는 이미
     * HTML에 실린 뒤라, 서명하지 않은 사람이 계약 정보를 읽어 갈 수 있다.
     * 아직 서명하지 않았다면 아무것도 만들지 않고 서명 페이지로 보낸다.
     * (반대 방향은 sign.tsx가 담당한다 — 서명이 끝났으면 이 페이지로 보낸다.)
     */
    const status = getEffectiveStatus(contract);

    /**
     * 이용이 종료된 계약. 서명본은 법적 보존 대상이라 그대로 남으므로 이 화면을 보여준다.
     *
     * 예전엔 signed가 아니라는 이유로 서명 페이지로 되돌렸는데, sign.tsx의 상태 분기에
     * terminated가 없어 **이미 서명을 마친 고객에게 빈 서명 패드**가 떴다. 고객 메일의
     * 영구 링크가 이 페이지를 가리키므로 여기서 끝내야 한다.
     */
    if (status !== 'signed' && status !== 'terminated') {
      return {
        redirect: {
          destination: `/${locale}/contracts/${id}/sign?token=${encodeURIComponent(token)}`,
          permanent: false,
        },
      };
    }

    return {
      props: {
        locale,
        contract: {
          customerName: contract.customerName,
          roomNumber: contract.roomNumber,
          startDate: contract.startDate.toISOString(),
          endDate: contract.endDate.toISOString(),
          monthlyRent: contract.monthlyRent,
          signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
        },
        downloadUrl: `/api/contracts/${contract.id}/download?token=${encodeURIComponent(token)}`,
        purged: contract.purgedAt !== null,
        ...(status === 'terminated' ? { terminated: true } : {}),
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/[id]/complete] Failed to load contract:', error);
    // DB 장애다 — "찾을 수 없다"고 말하면 안 된다. 서명은 이미 접수됐을 수 있다.
    return { props: { ...empty, unavailable: 'error' as const } };
  }
};


export default function ContractCompletePage({
  locale,
  contract,
  downloadUrl,
  purged,
  unavailable,
  terminated,
}: CompletePageProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  /**
   * 서명본에는 성명·생년월일·주소·서명 이미지가 들어 있다. 서명할 때 요구한 뒷자리를
   * 받을 때도 요구한다 — 안 그러면 링크를 전달받은 사람이 그대로 내려받을 수 있다.
   */
  const [identityDigits, setIdentityDigits] = useState('');

  /**
   * 링크로 바로 이동하지 않고 받아서 저장한다.
   *
   * API 라우트는 실패를 JSON으로 돌려주므로, 링크를 그대로 누르면 계약서 대신
   * {"ok":false,...} 한 줄이 적힌 흰 화면으로 넘어간다. 이 링크는 메일함에 영구히 남아
   * 몇 년 뒤에도 눌리는데, 그때 고객이 보는 것이 그 화면이어서는 안 된다.
   */
  if (unavailable || !contract) {
    // 장애로 못 읽은 것과 링크가 죽은 것은 고객이 할 일이 다르다. 제목부터 구분한다.
    const isError = unavailable === 'error';
    return (
      <>
        <Head>
          <title>
            {isError ? '계약서를 여는 중 문제가 생겼습니다' : '계약서를 찾을 수 없습니다'} | Studio NOL
          </title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <ContractNotice
          title={isError ? '계약서를 여는 중 문제가 생겼습니다' : '계약서를 찾을 수 없습니다'}
          description={
            isError
              ? '잠시 후 다시 시도해 주세요. 서명은 이미 접수되었을 수 있으니, 계속 같은 화면이 나오면 아래 번호로 알려 주세요.'
              : '링크가 만료되었거나 주소가 잘못되었습니다. 메일에 포함된 링크를 다시 확인해 주세요.'
          }
        />
      </>
    );
  }

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityDigits }),
      });

      if (!response.ok) {
        const message = await response
          .json()
          .then((body) => (typeof body?.message === 'string' ? body.message : null))
          .catch(() => null);
        setDownloadError(message ?? '계약서를 받지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${contract.customerName}_음악연습실_이용계약서.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setDownloadError('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Head>
        <title>서명 완료 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* URL에 서명 토큰이 들어 있어, 외부로 나가는 요청에 Referer로 실리면 유출된다. */}
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white dark:bg-white rounded-2xl shadow-sm p-8 md:p-12 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600 dark:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* 사이트 헤더를 붙이지 않으므로 여기가 브랜드를 밝히는 유일한 자리다. */}
          <p className="text-gray-400 dark:text-gray-400 text-sm font-medium mb-2">스튜디오 놀</p>
          <h1 className="typo-page-title text-gray-900 dark:text-gray-900 mb-3">계약서 서명 완료</h1>
          <p className="text-gray-600 dark:text-gray-600 mb-8 leading-relaxed">
            {/* 파기된 계약은 이름 자리에 "(개인정보 파기됨)"이 들어 있다. 그대로 부르면
                기계가 사람 이름을 잘못 읽은 것처럼 보인다. */}
            <span className="block">
              {purged ? '계약서 서명이 완료된 계약입니다.' : `${contract.customerName}님, 계약서 서명이 정상적으로 완료되었습니다.`}
            </span>
            {/* 메일은 이 화면을 그린 뒤에 발송되므로 "보냈다"고 단정할 수 없다. 아래에
                내려받기 버튼과 전화번호가 있으니, 오지 않았을 때 할 일을 함께 적는다. */}
            <span className="block">
              {purged ? '보관 기간이 지나 개인정보를 파기했습니다.' : '서명본 PDF를 첨부한 확인 메일도 함께 보내 드립니다.'}
            </span>
          </p>

          {/* 종료된 계약도 서명본은 법적 보존 대상이라 이 화면을 그대로 보여준다. 다만
              진행 중인 계약처럼 읽히면 안 되므로 사실을 밝힌다. */}
          {terminated && (
            <p className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-200 dark:bg-gray-50 dark:text-gray-700">
              이 계약은 <strong>이용이 종료</strong>되었습니다. 서명본은 그대로 보관되며 아래에서
              내려받을 수 있습니다.
            </p>
          )}

          <div className="bg-gray-50 dark:bg-gray-50 rounded-xl p-6 text-left mb-8">
            <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <dt className="text-gray-500 dark:text-gray-500">이용 호실</dt>
              <dd className="text-gray-900 dark:text-gray-900 font-medium text-right">{contract.roomNumber}호</dd>

              <dt className="text-gray-500 dark:text-gray-500">계약 기간</dt>
              <dd className="text-gray-900 dark:text-gray-900 font-medium text-right">
                {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
              </dd>

              <dt className="text-gray-500 dark:text-gray-500">월 이용료</dt>
              <dd className="text-gray-900 dark:text-gray-900 font-medium text-right">
                {new Intl.NumberFormat('ko-KR').format(contract.monthlyRent)}원
              </dd>

              <dt className="text-gray-500 dark:text-gray-500">서명일</dt>
              <dd className="text-gray-900 dark:text-gray-900 font-medium text-right">
                {formatDate(contract.signedAt)}
              </dd>
            </dl>
          </div>

          {/* 메일이 유실되거나 첨부가 열리지 않는 경우가 있어, 이 자리에서 바로 받을 수 있게 한다.
              보관 기간이 지나 파기된 계약은 내려받을 원본이 없다 — 눌러도 실패하는 버튼 대신
              왜 받을 수 없는지 알린다. */}
          {purged ? (
            <p className="text-sm text-gray-600 dark:text-gray-600 bg-gray-50 dark:bg-gray-50 rounded-xl p-4 mb-6 leading-relaxed">
              <span className="block">보관 기간(3년)이 지나 계약 원본과 개인정보를 파기했습니다.</span>
              <span className="block">문의는 010-4255-7893으로 연락해 주세요.</span>
            </p>
          ) : (
            <>
              <label
                htmlFor="download-identity-digits"
                className="block text-left text-sm text-gray-600 dark:text-gray-600 mb-2"
              >
                본인 확인을 위해 계약서에 등록된 연락처 뒤 {IDENTITY_DIGITS}자리를 입력해 주세요.
              </label>
              <TextInput
                id="download-identity-digits"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={IDENTITY_DIGITS}
                value={identityDigits}
                onChange={(event) => setIdentityDigits(event.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                aria-describedby={downloadError ? 'download-identity-error' : undefined}
                aria-invalid={downloadError ? true : undefined}
                invalid={Boolean(downloadError)}
                light className="mb-4 px-4 py-3 text-center text-lg tracking-[0.5em]"
              />

              <Button
                size="lg"
                fullWidth
                disabled={downloading || identityDigits.length !== IDENTITY_DIGITS}
                onClick={handleDownload}
              >
                {downloading ? '준비 중…' : '계약서 PDF 내려받기'}
              </Button>

              {downloadError && (
                <p
                  id="download-identity-error"
                  role="alert"
                  className="mt-3 text-sm text-red-700 dark:text-red-700 bg-red-50 dark:bg-red-50 rounded-xl p-3 leading-relaxed"
                >
                  <span className="block">{downloadError}</span>
                  <span className="block">계약서는 메일로도 보내 드렸습니다. 급하시면 010-4255-7893으로 연락해 주세요.</span>
                </p>
              )}

              <p className="text-sm text-gray-500 dark:text-gray-500 mt-4 mb-6">
                같은 계약서를 메일로도 보내 드렸습니다. 메일이 오지 않았다면 스팸함을 확인하시거나
                010-4255-7893으로 문의해 주세요.
              </p>
            </>
          )}

          <Link href={`/${locale}`} passHref>
            <Button size="lg" variant="outline" fullWidth>
              스튜디오 홈으로
            </Button>
          </Link>
        </div>
      </main>
    </>
  );
}
