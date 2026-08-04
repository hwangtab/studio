import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { Button } from '../../../../components/ui/Button';
import { getDb } from '../../../../db/client';
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
  contract: CompleteViewContract;
  /** 계약서를 다시 받는 주소. 토큰이 실려 있어 본인만 접근할 수 있다. */
  downloadUrl: string;
  /** 보관 기간이 지나 개인정보가 파기된 계약 — 내려받을 원본이 없다. */
  purged: boolean;
}

export const getServerSideProps: GetServerSideProps<CompletePageProps> = async (context) => {
  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;

  // 토큰을 필수로 요구한다. 없으면 계약 ID만 알아도 이용자의 개인정보를 볼 수 있게 된다.
  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  try {
    const contract = await getDb().query.contracts.findFirst({
      where: (contracts, { eq, and }) => and(eq(contracts.id, id), eq(contracts.signToken, token)),
    });

    if (!contract) {
      return { notFound: true };
    }

    /**
     * 서명 전에는 이 페이지를 열지 않는다 — 서명 페이지가 갈 곳을 안내한다.
     *
     * 화면을 숨기는 것만으로는 부족하다. 렌더 단계에서 분기해도 props는 이미
     * HTML에 실린 뒤라, 서명하지 않은 사람이 계약 정보를 읽어 갈 수 있다.
     * 아직 서명하지 않았다면 아무것도 만들지 않고 서명 페이지로 보낸다.
     * (반대 방향은 sign.tsx가 담당한다 — 서명이 끝났으면 이 페이지로 보낸다.)
     */
    if (getEffectiveStatus(contract) !== 'signed') {
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
      },
    };
  } catch (error: unknown) {
    console.error('[contracts/[id]/complete] Failed to load contract:', error);
    return { notFound: true };
  }
};

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function ContractCompletePage({
  locale,
  contract,
  downloadUrl,
  purged,
}: CompletePageProps) {
  return (
    <>
      <Head>
        <title>서명 완료 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
        {/* URL에 서명 토큰이 들어 있어, 외부로 나가는 요청에 Referer로 실리면 유출된다. */}
        <meta name="referrer" content="no-referrer" />
      </Head>

      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">계약서 서명 완료</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            {contract.customerName}님, 계약서 서명이 정상적으로 완료되었습니다.
            <br />
            서명본 PDF를 첨부한 확인 메일을 보내 드렸습니다.
          </p>

          <div className="bg-gray-50 rounded-xl p-6 text-left mb-8">
            <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <dt className="text-gray-500">이용 호실</dt>
              <dd className="text-gray-900 font-medium text-right">{contract.roomNumber}호</dd>

              <dt className="text-gray-500">계약 기간</dt>
              <dd className="text-gray-900 font-medium text-right">
                {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
              </dd>

              <dt className="text-gray-500">월 이용료</dt>
              <dd className="text-gray-900 font-medium text-right">
                {new Intl.NumberFormat('ko-KR').format(contract.monthlyRent)}원
              </dd>

              <dt className="text-gray-500">서명일</dt>
              <dd className="text-gray-900 font-medium text-right">
                {formatDate(contract.signedAt)}
              </dd>
            </dl>
          </div>

          {/* 메일이 유실되거나 첨부가 열리지 않는 경우가 있어, 이 자리에서 바로 받을 수 있게 한다.
              보관 기간이 지나 파기된 계약은 내려받을 원본이 없다 — 눌러도 실패하는 버튼 대신
              왜 받을 수 없는지 알린다. */}
          {purged ? (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4 mb-6 leading-relaxed">
              보관 기간(3년)이 지나 계약 원본과 개인정보를 파기했습니다.
              <br />
              문의는 010-4255-7893으로 연락해 주세요.
            </p>
          ) : (
            <>
              <a href={downloadUrl} className="block">
                <Button size="lg" fullWidth>
                  계약서 PDF 내려받기
                </Button>
              </a>

              <p className="text-sm text-gray-500 mt-4 mb-6">
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
