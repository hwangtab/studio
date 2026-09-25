import React from 'react';
import { m } from 'framer-motion';
import { cn } from '../../lib/utils';
import { SCROLL_REVEAL } from '../../utils/animationUtils';
import { useDesignEdition } from '../../lib/designEdition';


interface SectionHeadingProps {
  icon?: React.ElementType<{ className?: string }>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  titleClassName?: string;
  /** v2 전용: 제목 위 작은 라벨(예: "서비스"). v1에서는 무시된다. */
  eyebrow?: React.ReactNode;
  /** v2 전용: eyebrow 앞 번호(예: "03"). 장식이라 스크린리더에는 읽히지 않는다. */
  index?: string;
}

const SectionHeading = ({
  icon: Icon,
  title,
  subtitle,
  align = 'center',
  className,
  as: Component = 'h2',
  titleClassName,
  eyebrow,
  index,
}: SectionHeadingProps) => {
  const edition = useDesignEdition();

  // v2: 원형 아이콘·그라디언트 제목·가운데 정렬을 버리고 eyebrow + 잉크 대형 제목으로.
  // 아래 v1 경로는 손대지 않는다 — v1 페이지 HTML이 그대로인지는 골든 HTML 비교가 본다.
  // 정렬은 좌측 고정: align prop은 v1 레이아웃 문법이라 v2에서는 받지 않는다.
  if (edition === 'v2') {
    return (
      <div className={cn('v2-reveal text-left mb-10 md:mb-14', className)}>
        {eyebrow && (
          <p className="typo-eyebrow mb-4 flex items-center gap-3">
            {index && (
              <>
                <span aria-hidden="true">{index}</span>
                <span aria-hidden="true" className="h-px w-8 bg-current opacity-40" />
              </>
            )}
            <span>{eyebrow}</span>
          </p>
        )}
        <Component className={cn('typo-display-section max-w-4xl', titleClassName)}>
          {title}
        </Component>
        {subtitle && (
          <p className="typo-section-lead mt-4 max-w-2xl break-words">
            {subtitle}
          </p>
        )}
      </div>
    );
  }

  const alignmentClasses = {
    center: 'text-center',
    left: 'text-left',
  };

  return (
    <m.div
      className={cn(
        alignmentClasses[align] ?? alignmentClasses.center,
        "mb-12",
        className
      )}
      initial="initial"
      whileInView="whileInView"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      variants={SCROLL_REVEAL}
    >
      {Icon && (
        <div className={cn(
          "inline-flex items-center justify-center p-3 bg-primary/10 dark:bg-primary/20 rounded-full mb-4",
          align === 'center' ? "mx-auto" : "" // Only center if alignment is center
        )} aria-hidden="true">
          {React.createElement(Icon, { className: "text-2xl text-primary dark:text-primary-lighter" })}
        </div>
      )}

      <Component
        className={cn(
          "typo-section-title text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent mb-3 break-words [overflow-wrap:anywhere]",
          titleClassName
        )}
      >
        {title}
      </Component>

      {subtitle && (
        <p className={cn("typo-section-lead max-w-2xl break-words [overflow-wrap:anywhere]", align === 'center' ? "mx-auto" : "")}>
          {subtitle}
        </p>
      )}
    </m.div>
  );
};

export default SectionHeading;
