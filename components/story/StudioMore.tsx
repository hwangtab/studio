import React from 'react';
import NextLink from 'next/link';
import { type Locale } from '../../lib/i18n';

interface StudioMoreProps {
  locale?: Locale;
}

/**
 * 가이드 하단의 "스튜디오 놀에서 한 걸음 더" 안내.
 *
 * 원래 24편의 본문에 634자짜리 동일 텍스트로 복붙돼 있었다(패딩 스크립트 산물).
 * 컴포넌트로 옮겨 색인 본문에서 빼고, 링크만 남긴다 — 링크는 내부 링크 자산이라
 * 지우지 않고 유지한다.
 *
 * 마이그레이션하면서 라벨 하나를 고쳤다: 원문의 "1:1 보컬·믹싱 레슨"은 실제로
 * 제공하지 않는 서비스다(스튜디오는 프로듀싱 레슨만 한다 — lesson 페이지 정본은
 * "MIDI·작곡·믹싱·마스터링 1:1"). factGuards의 보컬·악기 레슨 규칙이 1인칭 맥락만
 * 검사해서 링크 라벨로는 빠져나갔다.
 *
 * 렌더 텍스트 분량을 바꾸면 lib/storyContentPolicy.ts의 SHORTCODE_CHAR_ESTIMATES
 * ['studio-more']도 같이 맞출 것 — thin 판정에 직접 들어간다.
 */
const StudioMore: React.FC<StudioMoreProps> = ({ locale = 'ko' }) => {
  const p = (href: string) => `/${locale}${href}`;

  const links: { href: string; label: string; note: string }[] = [
    { href: p('/stories/onlinemix1'), label: '온라인 믹싱 의뢰', note: '집에서 작업하고 마감만 맡기는 방식' },
    { href: p('/stories/mixing-complete-guide'), label: '믹싱 완전 가이드', note: '강좌 전체 로드맵' },
    { href: p('/lesson'), label: '1:1 프로듀싱 레슨', note: 'MIDI·작곡·믹싱·마스터링' },
    { href: p('/practice-room'), label: '음악연습실', note: '보컬·기타·피아노·드럼 개별 방' },
    { href: p('/release-project'), label: '발매 프로젝트', note: '기획·유통·홍보까지 동행' },
    { href: p('/pricing'), label: '요금·이용 안내', note: '녹음·믹싱·마스터링 플랜' },
    { href: p('/contact'), label: '찾아오는 길·문의', note: '카카오톡 상담' },
  ];

  return (
    <div className="my-8 rounded-xl glass-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">스튜디오 놀에서 한 걸음 더</h4>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          연신내역 도보 5분. 녹음·믹싱·마스터링과 연습실을 한 건물에서 이용할 수 있습니다.
        </p>
      </div>
      <ul className="px-6 py-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {links.map((l) => (
          <li key={l.href} className="text-sm text-gray-700 dark:text-gray-300">
            <NextLink
              href={l.href}
              prefetch={false}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              {l.label}
            </NextLink>
            <span className="text-gray-500 dark:text-gray-400"> — {l.note}</span>
          </li>
        ))}
      </ul>
      <p className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-400">
        작업하다 막히는 부분은 카카오톡으로 트랙 일부만 보내 주셔도 원인을 짚어 드립니다.
      </p>
    </div>
  );
};

export default StudioMore;
