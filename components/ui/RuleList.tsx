import React from 'react';
import { cn } from '../../lib/utils';

/**
 * 괘선 목록(라이너 노트 §3-5, docs/design-liner-notes-plan-2026-10.md).
 *
 * 홈 "처음이어도 안심하고 맡기는 이유" 절의 문법을 공용으로 뽑은 것 — 굵은 괘선 위에 번호·제목·본문. **읽는 것**
 * (FAQ 요약·절차·이유)은 이걸로, 떠 있는 카드는 고르는 것(티어·리워드·시간 슬롯)에만 둔다(design-system §3). 카드
 * 그리드에 걸던 스크롤 모션·hover 스케일은 없다(iOS 깜빡임 이력, 디자인 회의).
 *
 * 번호는 장식이라 스크린리더에서 숨긴다 — `<ol>`이 이미 순서를 전달한다. 순서가 정보가 아닌 목록(FAQ 요약)은
 * `as="ul"`로 두고 `labelPrefix="Q"`처럼 라벨만 붙인다.
 */
export interface RuleListItem {
  heading: React.ReactNode;
  body?: React.ReactNode;
  /** 항목 키 — 제목이 ReactNode일 때 넘긴다. */
  key?: string;
}

export interface RuleListProps {
  items: readonly RuleListItem[];
  /** 데스크톱 열 수. 모바일은 항상 1열. */
  columns?: 1 | 2 | 3 | 4;
  /** 번호(01·02…)를 붙인다. */
  numbered?: boolean;
  /** 번호 앞 글자(예: "Q" → Q1·Q2). numbered가 있어야 그려진다. 두 자리 0 채움은 prefix가 없을 때만. */
  labelPrefix?: string;
  as?: 'ol' | 'ul';
  headingAs?: 'h3' | 'h4' | 'p';
  className?: string;
}

const COLUMNS: Record<NonNullable<RuleListProps['columns']>, string> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export const RuleList = ({
  items,
  columns = 3,
  numbered = false,
  labelPrefix,
  as: List = numbered ? 'ol' : 'ul',
  headingAs: Heading = 'h3',
  className,
}: RuleListProps) => {
  if (items.length === 0) return null;
  return (
    <List className={cn('grid gap-10 md:gap-8', COLUMNS[columns], className)}>
      {items.map((item, index) => (
        <li key={item.key ?? (typeof item.heading === 'string' ? item.heading : index)} className="border-t-2 border-gray-950 dark:border-white pt-5">
          {numbered && (
            <span aria-hidden="true" className="block text-sm font-semibold tabular-nums text-gray-600 dark:text-gray-300 mb-3">
              {labelPrefix ? `${labelPrefix}${index + 1}` : String(index + 1).padStart(2, '0')}
            </span>
          )}
          <Heading className="font-title text-xl font-bold leading-snug text-gray-950 dark:text-white mb-3 break-keep">
            {item.heading}
          </Heading>
          {item.body && <p className="typo-card-body text-gray-600 dark:text-gray-300">{item.body}</p>}
        </li>
      ))}
    </List>
  );
};

export default RuleList;
