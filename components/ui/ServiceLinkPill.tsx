import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@/lib/lucide-icons';
import { cn } from '../../lib/utils';

/**
 * 아웃라인 서비스 링크 pill.
 *
 * 같은 className 문자열이 9개 파일에 45번 복붙돼 있었고, **접근성 회귀 두 번이 전부
 * 여기서 났다** — 다크 텍스트 대비 미달(2026-09-11 1·2라운드)과, 그 다크 짝을 추가하는
 * 행위 자체가 `hover:text-white`를 명시도로 덮어쓴 회귀(3라운드, 53곳). 게다가 45곳
 * 전부 `focus-visible` 링이 없어 키보드 사용자는 포커스 위치를 볼 수 없었다.
 *
 * 세 규칙이 이 파일 한 곳에만 있으면 같은 사고가 구조적으로 사라진다:
 *
 * 1. 다크 짝은 `-lighter`/`-light`만 쓴다. 정본 §1 대비 표 기준으로 gray-900 배경 위
 *    `primary`(2.83:1)·`primary-light`(3.53:1)는 AA 미달이고 `primary-lighter`가 7.40:1,
 *    `secondary-light`가 5.71:1, `accent-light`가 7.94:1로 통과한다.
 * 2. `dark:text-*`를 쓰면 `dark:hover:text-white`를 **반드시** 함께 쓴다. Tailwind가 내는
 *    `.dark\:text-x:is(.dark *)`와 `.hover\:text-white:hover`는 명시도가 둘 다 (0,2,0)으로
 *    같고 `dark:` 규칙이 CSS 뒤에 나와 hover 색이 진다. `dark:hover:`는 (0,3,0)이라 이긴다.
 * 3. 인터랙티브 요소에는 `focus-visible` 링(정본 §5)과 44px 터치 타깃. 링 **알파는 /70**이고
 *    다크에서는 텍스트와 같은 논리로 밝은 짝을 쓴다 — 포커스 표시기는 텍스트가 아니라
 *    WCAG 2.2 SC 1.4.11(3:1)의 대상이고, 기준은 "링 합성색 vs 표면색"이다. 정본이 표준으로
 *    말해 온 `/40`은 라이트 2.04:1, 다크 1.33:1로 **있지만 안 보이는 링**이다(정본 §5·§9).
 *
 * `prefetch={false}`가 기본값인 이유: 이 pill들은 본문 fold 안에 무더기로 놓이는데,
 * 자동 prefetch를 두면 목적지 페이지의 무거운 SSG JSON을 한꺼번에 받는다. hover/focus
 * 시 prefetch는 next/link 기본 휴리스틱으로 그대로 작동한다.
 */
export type ServiceLinkTone = 'primary' | 'secondary' | 'accent';

/**
 * px-6 py-3 = 24px 패딩 + 24px 라인박스 = 48px이라 `min-h-[44px]`는 현재 호출부에서
 * 시각 변화가 없다. 그럼에도 두는 이유는 패딩을 줄인 변형(about의 px-5 py-2.5)이
 * 이미 있고, 그런 변형이 44px 아래로 내려가는 것을 base에서 막기 위해서다.
 */
const BASE =
  'inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-full border-2 font-semibold ' +
  'transition-colors duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900';

const TONE_CLASS: Record<ServiceLinkTone, string> = {
  primary:
    'border-primary text-primary dark:text-primary-lighter hover:bg-primary hover:text-white dark:hover:text-white ' +
    'focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70',
  secondary:
    'border-secondary text-secondary dark:text-secondary-light hover:bg-secondary hover:text-white dark:hover:text-white ' +
    'focus-visible:ring-secondary/70 dark:focus-visible:ring-secondary-light/70',
  accent:
    'border-accent text-accent dark:text-accent-light hover:bg-accent hover:text-white dark:hover:text-white ' +
    'focus-visible:ring-accent/70 dark:focus-visible:ring-accent-light/70',
};

/**
 * 테스트·예외 호출부가 최종 클래스를 직접 확인할 수 있게 노출한다.
 * `className`은 twMerge로 합쳐지므로 반경·패딩 같은 충돌 유틸리티는 뒤가 이긴다.
 */
export const serviceLinkPillClass = (tone: ServiceLinkTone, className?: string): string =>
  cn(BASE, TONE_CLASS[tone], className);

type NextLinkProps = React.ComponentPropsWithoutRef<typeof Link>;

export interface ServiceLinkPillProps extends Omit<NextLinkProps, 'className' | 'children'> {
  tone?: ServiceLinkTone;
  /** 라벨 뒤 화살표. 카드 안 버튼 줄에 섞여 쓰는 한 곳만 false. */
  showArrow?: boolean;
  className?: string;
  children: React.ReactNode;
}

const ServiceLinkPill = ({
  tone = 'primary',
  showArrow = true,
  prefetch = false,
  className,
  children,
  ...rest
}: ServiceLinkPillProps) => (
  <Link {...rest} prefetch={prefetch} className={serviceLinkPillClass(tone, className)}>
    {children}
    {showArrow && (
      <> <ArrowRight size={16} aria-hidden="true" /></>
    )}
  </Link>
);

export default ServiceLinkPill;
