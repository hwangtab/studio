import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { BUTTON_DEPTH } from './buttonDepth';

const buttonVariants = cva(
  // transition-all → 명시 property: iOS Safari에서 transition-all은 layout 트리거 가능 속성도
  // 보간해 hover 시 reflow 깜빡 유발. 시각 변화는 colors·shadow·transform만.
  // 반경은 shape variant가 소유한다 — 여기에 rounded-*를 두면 pill과 충돌한다.
  //
  // box-shadow는 transition 목록에 넣지 않는다. Tailwind의 `ring-*`는 outline이 아니라
  // **box-shadow로** 그려지므로, box-shadow를 보간하면 포커스 링이 0px·투명에서
  // duration만큼 서서히 나타난다 — Tab으로 빠르게 넘기는 키보드 사용자는 링을 한 번도
  // 온전히 보지 못한다(2026-09-14 실측: t=0ms 0px → t=300ms 4px). 클래스·CSS 변수는
  // 전부 정상이라 정적 검사로는 드러나지 않고, `.focus()` 기반 측정도 :focus-visible을
  // 켜지 못해 놓친다. 측정 방법론은 docs/design-system.md §5.
  // hover shadow-md→lg는 이제 즉시 전환된다 — 포커스 표시기를 지연시키는 값이 아니다.
  //
  // `colors`는 CSS 속성 이름이 아니라 그냥 ident라 아무것도 보간하지 않았다(Tailwind의
  // `transition-colors`가 펼치는 4개 속성과 다르다). 2026-10-05 1단계에서 실제 속성
  // 4개(background-color·border-color·color·transform)로 고쳤다 — hover 색이 이제
  // duration-base로 전환된다. box-shadow는 위 이유로 여전히 넣지 않는다.
  "inline-flex items-center justify-center gap-2 typo-button transition-[background-color,border-color,color,transform] duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // 행동 버튼은 파랑(primary) — 파랑 = 누를 수 있는 것(2026-10-09 운영자 "버튼은 시인성 좋게 파란색 계열").
        // 흰 글씨 5.17:1, 라이트·다크 같은 면. 가격 숫자 같은 누를 수 없는 강조는 잉크라 버튼과 겹쳐 보이지 않는다.
        // 사진 위에서는 inverse(흰 버튼)를 쓴다.
        solid: `bg-primary text-white hover:bg-primary-dark hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${BUTTON_DEPTH.solid}`,
        // 어두운 히어로 사진 위 1차 행동(비-ko 문의 등). 라이트·다크 구분 없이 흰 버튼 + 잉크 글씨.
        inverse: `bg-white text-gray-950 hover:bg-gray-100 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-white/70 focus-visible:ring-offset-black/20 ${BUTTON_DEPTH.inverse}`,
        // 테두리 버튼 — 파랑 글씨·옅은 파랑 테두리. 다크는 primary-lighter(gray-900 위 약 9.9:1).
        outline: "border-2 border-primary/20 bg-transparent text-primary hover:bg-primary/5 hover:border-primary/40 dark:text-primary-lighter dark:border-primary-lighter/40 dark:hover:border-primary-lighter/60 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        secondary: "bg-white text-gray-900 shadow-sm hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // Liquid Glass 재질 버튼. bg/border/shadow는 .glass-regular(components 레이어)가
        // 제공하므로 여기에 bg-* 등 충돌 유틸리티를 추가하지 말 것 — utilities 레이어가
        // 재질을 덮어써 폴백(솔리드 강등)까지 깨진다.
        glass: "glass-regular text-gray-700 dark:text-gray-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 카카오톡 목적지 전용. 옐로 위 글자는 항상 kakao-ink(흰 글씨는 대비 1.3:1로 미달),
        // 포커스 링도 옐로 위에서 보이도록 ink를 쓴다.
        kakao: `bg-kakao text-kakao-ink hover:bg-kakao-dark hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-kakao-ink dark:focus-visible:ring-kakao focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${BUTTON_DEPTH.kakao}`,
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
      },
      /**
       * 라이트 고정 화면 옵트인. 실제 클래스는 compoundVariants가 준다 — cva는
       * compoundVariants를 variants **뒤**에 이어 붙이므로 twMerge에서 확실히 이긴다.
       * 여기에 클래스를 두면 variants 객체의 키 순서에 의존하게 되어 취약하다.
       */
      light: {
        true: "",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
      shape: "block",
    },
    /**
     * `public/scripts/theme-init.js`는 경로 예외 없이 모든 라우트에 `<html class="dark">`를
     * 붙인다. 그런데 docs/design-system.md §1대로 `pages/admin/**`과 계약 서명·완료 화면은
     * 종이처럼 항상 밝다 — 그 화면에서 다크 분기가 켜지면 흰 카드 위에 다크용 색이 뜬다
     * (outline의 다크용 primary-lighter 글씨가 흰 카드 위에서 1.6:1로 흐려진다). `Field`의 `light` 옵트인과 같은 처방.
     *
     * 실제로 라이트 고정 화면에서 쓰이는 variant만 되돌린다(solid·outline·ghost·secondary).
     * glass·kakao·scrim은 그 화면에 없다.
     */
    compoundVariants: [
      {
        light: true,
        variant: "solid",
        class: "dark:focus-visible:ring-primary/70 dark:focus-visible:ring-offset-white",
      },
      {
        light: true,
        variant: "outline",
        class: "dark:text-primary dark:border-primary/20 dark:hover:border-primary/40 dark:hover:bg-primary/5 dark:focus-visible:ring-primary/70 dark:focus-visible:ring-offset-white",
      },
      {
        light: true,
        variant: "ghost",
        class: "dark:text-gray-600 dark:hover:bg-gray-100 dark:focus-visible:ring-offset-white",
      },
      {
        light: true,
        variant: "secondary",
        class: "dark:bg-white dark:text-gray-900 dark:border-gray-200 dark:hover:bg-gray-50 dark:focus-visible:ring-offset-white",
      },
    ],
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
  ({ className, variant, size, shape, fullWidth, light, asChild, children, ...props }, ref) => {
    // light는 DOM 속성이 아니다 — 구조분해로 걷어내 <button>/<a>에 새지 않게 한다.
    const classes = cn(buttonVariants({ variant, size, shape, fullWidth, light, className }));

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
