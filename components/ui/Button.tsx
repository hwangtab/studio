import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  // transition-all → 명시 property: iOS Safari에서 transition-all은 layout 트리거 가능 속성도
  // 보간해 hover 시 reflow 깜빡 유발. 시각 변화는 colors·shadow·transform만.
  // 반경은 shape variant가 소유한다 — 여기에 rounded-*를 두면 pill과 충돌한다.
  "inline-flex items-center justify-center gap-2 typo-button transition-[colors,box-shadow,transform] duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        solid: "bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 다크 오버라이드는 필수다 — text-primary(#6d28d9)만 두면 gray-900 배경 위 대비가
        // 약 2.4:1로 AA(4.5:1)는 물론 대형 텍스트(3:1)에도 미달한다. 소비처
        // (HeroKakaoCta onSurface 전화·404/500 2차·PricingCard 2차)가 같은 결함을 공유하므로
        // 개별 className이 아니라 여기서 고친다.
        outline: "border-2 border-primary/20 bg-transparent text-primary hover:bg-primary/5 hover:border-primary/40 dark:text-primary-light dark:border-primary-light/30 dark:hover:border-primary-light/50 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        secondary: "bg-white text-gray-900 shadow-sm hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // Liquid Glass 재질 버튼. bg/border/shadow는 .glass-regular(components 레이어)가
        // 제공하므로 여기에 bg-* 등 충돌 유틸리티를 추가하지 말 것 — utilities 레이어가
        // 재질을 덮어써 폴백(솔리드 강등)까지 깨진다.
        glass: "glass-regular text-gray-700 dark:text-gray-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 카카오톡 목적지 전용. 옐로 위 글자는 항상 kakao-ink(흰 글씨는 대비 1.3:1로 미달),
        // 포커스 링도 옐로 위에서 보이도록 ink를 쓴다.
        kakao: "bg-kakao text-kakao-ink hover:bg-kakao-dark shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-kakao-ink focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 어두운 히어로 이미지 위 2차 액션. 흰 틴트(bg-white/*)는 배경을 밝혀 흰 글씨
        // 대비를 오히려 떨어뜨리므로 어두운 스크림 + 흰 테두리를 쓴다.
        scrim: "bg-black/30 border border-white/40 text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.55)] hover:bg-black/45 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-white/70 focus-visible:ring-offset-black/20",
      },
      size: {
        sm: "h-11 px-3 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-14 px-8 text-lg",
        // 기본 shape("block")과 조합하면 사각형이 된다 — 원형 아이콘 버튼이 필요하면
        // shape="pill"을 함께 지정할 것.
        icon: "h-11 w-11",
      },
      shape: {
        // 자유 배치 CTA(히어로·스티키·FAB·인라인 콜아웃)
        pill: "rounded-full",
        // 카드·폼 안의 버튼
        block: "rounded-xl",
      },
      fullWidth: {
        true: "w-full",
      }
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
      shape: "block",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * 단일 자식 엘리먼트(<a>·next/link)에 버튼 스타일을 합성해 그 자식을 렌더한다.
   * 링크를 버튼처럼 보이게 할 때 쓴다 — 이 저장소는 @radix-ui/react-slot을 두지 않으므로
   * cloneElement로 직접 구현한다. 자식의 className과 나머지 props는 보존된다.
   *
   * 주의: asChild일 때 ref는 자식 엘리먼트로 전달되므로, 실제 런타임 타입이
   * HTMLButtonElement가 아닐 수 있다(예: <a> asChild면 HTMLAnchorElement).
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, fullWidth, asChild, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, shape, fullWidth, className }));

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...props,
        ...child.props,
        // 병합 순서 주의: 자식의 props가 Button의 props를 **덮어쓴다**(합성이 아니다).
        // 이 저장소의 CTA는 추적 핸들러(trackLeadEvent)가 자식 <a>에 붙어 있어 이 순서가
        // 맞지만, <Button asChild onClick={...}>처럼 Button 쪽에 핸들러를 주면 자식에
        // 같은 이름이 있을 때 조용히 사라진다. 핸들러는 항상 자식에 붙일 것.
        // 자식의 className을 뒤에 둬 호출부가 개별 조정을 이길 수 있게 한다.
        className: cn(classes, child.props.className),
        ref,
      } as React.Attributes);
    }

    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
