import React from 'react';
import NextLink from 'next/link';
import { Button } from '../ui/Button';
import { getSiteConfig } from '../../data/siteConfig';
import { type Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface OnlineRequestProps {
  locale?: Locale;
}

/**
 * 가이드 본문의 "온라인 의뢰 서비스" 요약표.
 *
 * 30편에 같은 표가 복붙돼 있었고, 그 표는 소요 시간을 "2~5일 (협의)"로 적고 있었다.
 * 정본(믹싱·마스터링 페이지·FAQ)은 일관되게 "3~7영업일"이라 서비스 페이지보다 짧게
 * 약속하는 상태였다. 컴포넌트로 모으면서 정본 값으로 맞춘다. 수정 횟수도 마찬가지로
 * 믹싱 2회·마스터링 1회(data/pricing.ts, 믹싱 페이지 FAQ) 기준이다.
 *
 * 렌더 문구를 고치면 lib/storyContentPolicy.ts의 SHORTCODE_CHAR_ESTIMATES['online-request']도
 * 함께 맞출 것(thin 판정에 직접 들어간다).
 */
const OnlineRequest: React.FC<OnlineRequestProps> = ({ locale = 'ko' }) => {
  const siteConfig = getSiteConfig(locale);
  const rows: { label: string; body: React.ReactNode }[] = [
    { label: '보내실 것', body: '드라이 보컬 WAV와 MR 파일. 카카오톡으로 받습니다' },
    { label: '작업', body: '엔지니어가 믹싱·마스터링을 마쳐 완성 파일로 납품합니다' },
    { label: '수정', body: '믹싱 2회, 마스터링 1회가 기본 포함입니다' },
    {
      label: '소요 시간',
      body: (
        <>
          파일을 받은 뒤 3~7영업일 (
          <NextLink href={`/${locale}/mixing-mastering`} prefetch={false} className="rounded text-primary dark:text-primary-lighter hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
            요금·절차 보기
          </NextLink>
          )
        </>
      ),
    },
  ];

  return (
    <div className="my-8 rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">방문이 어렵다면 온라인으로</h4>
      </div>
      <dl className="px-6 py-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="sm:flex sm:gap-4">
            <dt className="sm:w-28 shrink-0 text-sm font-medium text-gray-900 dark:text-white">{r.label}</dt>
            <dd className="text-sm text-gray-700 dark:text-gray-300">{r.body}</dd>
          </div>
        ))}
      </dl>
      <div className="px-6 pb-5">
        {/* 반경·포커스 링은 Button이 소유한다 — 직접 짠 rounded-lg에는
            focus-visible 링이 아예 없었다(정본 §3·§5). */}
        <Button asChild variant="kakao" shape="block" size="md">
          <a
            href={siteConfig.contact.kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'OnlineRequest',
                cta_id: 'online_request_kakao',
              })
            }
            className="touch-manipulation"
          >
            카카오톡으로 파일 보내기
          </a>
        </Button>
      </div>
    </div>
  );
};

export default OnlineRequest;
