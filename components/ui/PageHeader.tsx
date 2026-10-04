import React from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { ArrowLeft } from '@/lib/lucide-icons';
import { FOCUS_RING } from './focusRing';

/**
 * 거래 화면(예약·주문·펀딩 결제·구독·관리·결과)의 바깥 틀과 머리.
 *
 * 2026-10-04 조사: 히어로 없는 화면의 컨테이너가 `max-w-lg`~`4xl` 다섯 폭, 상단 여백이
 * `py-12`·`16`·`24`·`pt-28`(+Layout `pt-20`) 네 가지, h1이 세 스케일, 브랜드 줄 두 벌,
 * 뒤로 링크 네 모양이었다. 같은 돈을 내는 화면이 흐름마다 다른 집처럼 보였다.
 *
 * `PageShell` 폭: form(2xl, 폼·관리) / result(lg, 결과) / wide(3xl, 목록·개설자).
 * 세로 여백은 `py-12 sm:py-16` 하나 — Layout이 이미 `pt-20`을 넣으므로 더하지 않는다.
 * `<main>`은 Layout이 제공한다 — 여기서 다시 만들면 main이 겹친다(조사에서 전 거래 화면이
 * 그랬다).
 */
export type PageShellWidth = 'form' | 'result' | 'wide';

const WIDTH: Record<PageShellWidth, string> = {
  form: 'max-w-2xl',
  result: 'max-w-lg',
  wide: 'max-w-3xl',
};

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: PageShellWidth;
  children: React.ReactNode;
}

export const PageShell = ({ width = 'form', className, children, ...rest }: PageShellProps) => (
  <div className={cn('mx-auto w-full min-w-0 px-4 py-12 sm:py-16', WIDTH[width], className)} {...rest}>
    {children}
  </div>
);

export interface PageHeaderProps {
  /** 헤더 없는(bare) 화면의 브랜드 줄. 기본 "스튜디오 놀". `false`면 없음. */
  brand?: React.ReactNode | false;
  backHref?: string;
  backLabel?: React.ReactNode;
  title: React.ReactNode;
  as?: 'h1' | 'h2';
  /** 제목 아래 한두 문장. */
  lead?: React.ReactNode;
  /** 제목 오른쪽(또는 아래) 메타 — 주문번호·상태 배지. */
  meta?: React.ReactNode;
  align?: 'left' | 'center';
  /** 머리 아래 블록(`Stepper` 등). */
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  brand = false,
  backHref,
  backLabel = '뒤로',
  title,
  as: Heading = 'h1',
  lead,
  meta,
  align = 'left',
  children,
  className,
}: PageHeaderProps) => {
  const centered = align === 'center';
  return (
    <header className={cn('mb-8', centered && 'text-center', className)}>
      {backHref && (
        <Link
          href={backHref}
          prefetch={false}
          className={cn(
            // 글자 링크지만 터치 영역은 44px — 위아래 패딩을 음수 마진으로 상쇄해 자리는 안 차지한다.
            '-my-2 inline-flex min-h-[44px] items-center gap-1 rounded-md py-2 typo-card-meta text-primary hover:underline dark:text-primary-lighter',
            FOCUS_RING,
          )}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      {brand !== false && (
        <p className={cn('typo-card-meta', backHref ? 'mt-4' : undefined)}>{brand === true || brand === undefined ? '스튜디오 놀' : brand}</p>
      )}
      <div className={cn('mt-2 flex flex-wrap items-start gap-x-4 gap-y-2', centered ? 'justify-center' : 'justify-between')}>
        <Heading className="typo-page-title">{title}</Heading>
        {meta && <div className="typo-card-meta flex items-center gap-2">{meta}</div>}
      </div>
      {lead && <p className={cn('mt-2 typo-body text-gray-600 dark:text-gray-400', centered && 'mx-auto max-w-prose')}>{lead}</p>}
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
};
