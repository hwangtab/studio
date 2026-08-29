import React from 'react';
import NextLink from 'next/link';
import { type Locale } from '../../lib/i18n';

interface StudioServicesProps {
  locale?: Locale;
}

/**
 * 가이드 본문의 "스튜디오 놀 서비스" 요약표.
 *
 * 21편에 같은 표가 복붙돼 있던 것을 컴포넌트로 모았다. 수정 횟수는 정본
 * (data/pricing.ts "기본 2회 수정 포함", 믹싱·마스터링 페이지 "믹싱 2회·마스터링 1회")에
 * 맞춰 적는다 — 원래 표는 "2라운드 수정 포함"이라고만 해서 마스터링까지 2회로 읽혔다.
 *
 * 렌더 문구를 고치면 lib/storyContentPolicy.ts의 SHORTCODE_CHAR_ESTIMATES['studio-services']도
 * 함께 맞출 것(thin 판정에 직접 들어간다).
 */
const StudioServices: React.FC<StudioServicesProps> = ({ locale = 'ko' }) => {
  const rows: { label: string; body: React.ReactNode }[] = [
    { label: '보컬 녹음', body: 'Neumann U87Ai, 전용 흡음 부스, 엔지니어 1:1 디렉팅' },
    { label: '믹싱·마스터링', body: '보컬과 MR을 함께 정리하며, 믹싱 2회·마스터링 1회 수정이 기본입니다' },
    {
      label: '온라인 의뢰',
      body: (
        <>
          방문 없이 파일만 보내도 진행됩니다 (
          <NextLink href={`/${locale}/mixing-mastering`} prefetch={false} className="text-primary hover:underline underline-offset-4">
            믹싱·마스터링 안내
          </NextLink>
          )
        </>
      ),
    },
    { label: '예약', body: '카카오톡 오픈채팅으로 일정을 잡습니다' },
  ];

  return (
    <div className="my-8 rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">스튜디오 놀에서 할 수 있는 것</h4>
      </div>
      <dl className="px-6 py-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="sm:flex sm:gap-4">
            <dt className="sm:w-32 shrink-0 text-sm font-medium text-gray-900 dark:text-white">{r.label}</dt>
            <dd className="text-sm text-gray-700 dark:text-gray-300">{r.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default StudioServices;
