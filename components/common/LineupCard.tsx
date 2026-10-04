import type { ReactNode } from 'react';

import ResponsiveImage from '../ResponsiveImage';
import BaseCard from '../ui/BaseCard';

interface Props {
  /** 원형 프로필 사진. 없으면 사진 칸 없이 글만 그린다. */
  photo?: string;
  /** b2b 세트·듀오처럼 한 슬롯을 둘이 쓸 때. photo 위 오른쪽 아래에 작게 겹쳐 그린다. */
  photoSecondary?: string;
  /** 주 사진의 alt. */
  photoAlt?: string;
  /** 있으면 카드 전체가 링크(새 탭)가 된다. */
  href?: string;
  /** 이름 줄 — 글자 하나일 수도, 사람별 링크 여러 개일 수도 있어 노드로 받는다. */
  name: ReactNode;
  bio?: string | null;
  className?: string;
}

/**
 * 출연진 카드 — 원형 사진 + 이름 + 소개를 한 줄에. 펀딩(`FundingLineupPerson`)과 공연
 * (`ShowLineup`)이 같은 모양을 쓰도록 여기 한 곳에 둔다.
 *
 * 재질은 `BaseCard variant="glass"` — 옆 카드들과 같은 유리 재질이어야 나란히 놓였을 때 이
 * 카드만 평평해 보이지 않는다(운영자 지적 2026-09-30, 손으로 만든 박스로 한 번 냈다가 고쳤다).
 * 카드 전체를 링크로 감싸는 것도 `BaseCard`의 `href`가 hover 리프트·press 스케일을 붙여 준다.
 */
export default function LineupCard({ photo, photoSecondary, photoAlt, href, name, bio, className = '' }: Props) {
  const linkProps = href ? { href, target: '_blank' } : {};
  return (
    <BaseCard variant="glass" padding="compact" className={`flex items-start gap-4 ${className}`.trim()} {...linkProps}>
      {photo && (
        <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <ResponsiveImage src={photo} alt={photoAlt ?? '프로필 사진'} fill sizes="80px" className="object-cover" />
          </div>
          {photoSecondary && (
            <div className="absolute bottom-0 right-0 h-9 w-9 overflow-hidden rounded-full ring-2 ring-white dark:ring-gray-900 sm:h-11 sm:w-11">
              <ResponsiveImage src={photoSecondary} alt="" fill sizes="44px" className="object-cover" />
            </div>
          )}
        </div>
      )}
      <div className="min-w-0 text-lg">
        {/* <p>가 아니라 <div>다 — 이 카드는 마크다운 본문 `.prose` 안에서도 렌더되는데,
            styles/globals.css의 `.prose p`(margin-bottom 1.5em)·`.prose p+p`(margin-top 1.5em)가
            태그 선택자라 우리 mt-1(4px) 지정보다 특정도가 높아 그대로 덮어쓴다(운영자 지적
            2026-09-30: "패딩이 아주 어색해" — 실측 bio 문단 margin-top이 4px가 아니라 21px).
            div는 태그가 달라 두 선택자 모두 매치되지 않는다. */}
        <div className="break-keep font-bold leading-snug text-gray-900 dark:text-white">{name}</div>
        {bio && <div className="mt-1 break-keep text-sm leading-relaxed text-gray-600 dark:text-gray-300">{bio}</div>}
      </div>
    </BaseCard>
  );
}
