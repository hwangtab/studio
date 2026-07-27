import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { Button } from '../../../../components/ui/Button';
import { db } from '../../../../db/client';
import { serializeContract, type SerializedContract } from '../../../../lib/contracts/serialize';

interface CompletePageProps {
  locale: string;
  contract: SerializedContract;
}

export const getServerSideProps: GetServerSideProps<CompletePageProps> = async (context) => {
  const { locale, id } = context.params as { locale: string; id: string };
  const { token } = context.query;

  // 토큰을 필수로 요구한다. 없으면 계약 ID만 알아도 이용자의 개인정보를 볼 수 있게 된다.
  if (!id || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }

  try {
    const contract = await db.query.contracts.findFirst({
      where: (contracts, { eq, and }) => and(eq(contracts.id, id), eq(contracts.signToken, token)),
    });

    if (!contract) {
      return { notFound: true };
    }

    return { props: { locale, contract: serializeContract(contract) } };
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

export default function ContractCompletePage({ locale, contract }: CompletePageProps) {
  const signed = contract.status === 'signed';

  return (
    <>
      <Head>
        <title>서명 완료 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
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
            {signed
              ? '서명본 PDF를 첨부한 확인 메일을 보내 드렸습니다.'
              : '확인 메일을 발송했습니다.'}
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

          <p className="text-sm text-gray-500 mb-6">
            메일이 오지 않았다면 스팸함을 확인하시거나 010-4255-7893으로 문의해 주세요.
          </p>

          <Link href={`/${locale}`} passHref>
            <Button size="lg" fullWidth>
              스튜디오 홈으로
            </Button>
          </Link>
        </div>
      </main>
    </>
  );
}
