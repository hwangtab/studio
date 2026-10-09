import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

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
  //
  // 버튼은 평평하다 — 그림자·그라디언트·hover 떠오름 없음. 반응은 두 가지뿐(2026-10-09 TDS 대조, 운영자 "입체감이 과하다"):
  // hover는 색이 진해지고(마우스 기기에서만, tailwind future.hoverOnlyWhenSupported), 누르면 0.96배로 줄며 어두워진다.
  // 눌림은 75ms로 빠르게, 놓을 때는 duration-base. 손으로 짠 버튼은 components/ui/buttonPress.ts의 BUTTON_PRESS.
  "inline-flex items-center justify-center gap-2 typo-button transition-[background-color,border-color,color,transform,filter] duration-base ease-standard active:duration-75 active:scale-[0.96] active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // 행동 버튼은 파랑(primary) — 파랑 = 누를 수 있는 것(2026-10-09 운영자 "버튼은 시인성 좋게 파란색 계열").
        // 흰 글씨 5.17:1, 라이트·다크 같은 평평한 면. 가격 숫자 같은 누를 수 없는 강조는 잉크라 버튼과 겹쳐 보이지 않는다.
        // 사진 위에서는 inverse(흰 버튼)를 쓴다.
        solid: "bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 어두운 히어로 사진 위 1차 행동(비-ko 문의 등). 라이트·다크 구분 없이 흰 버튼 + 잉크 글씨.
        inverse: "bg-white text-gray-950 hover:bg-gray-100 focus-visible:ring-white/70 focus-visible:ring-offset-black/20",
        // 연한 파랑 버튼(weak) — 2차 행동. 테두리 버튼은 얇은 선이라 누를 수 있다는 신호가 약했다(TDS도 보조 버튼을
        // 테두리가 아니라 옅은 채움으로 둔다). primary-dark 글씨 on primary/10 약 5.8:1, 다크는 primary-lighter.
        weak: "bg-primary/10 text-primary-dark hover:bg-primary/15 dark:bg-primary-lighter/15 dark:text-primary-lighter dark:hover:bg-primary-lighter/20 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        secondary: "bg-white text-gray-900 hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 카카오톡 목적지 전용. 옐로 위 글자는 항상 kakao-ink(흰 글씨는 대비 1.3:1로 미달),
        // 포커스 링도 옐로 위에서 보이도록 ink를 쓴다.
        kakao: "bg-kakao text-kakao-ink hover:bg-kakao-dark focus-visible:ring-kakao-ink dark:focus-visible:ring-kakao focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 어두운 히어로 사진 위 2차 행동 — 거의 불투명한 잉크 면(테두리·글자 그림자 없음). 예전 bg-black/30 + 흰 40% 테두리는
        // 사진이 비쳐 "사진 위에 그린 상자"로 보였다(운영자 2026-10-09 "투명 버튼 가시성이 안 좋다", TDS: 보조도 채운 면).
        // 노란 카톡 1차와 위계가 뒤집히지 않게 흰 면(inverse) 대신 잉크.
        scrim: "bg-gray-950/85 text-white hover:bg-gray-950 focus-visible:ring-white/70 focus-visible:ring-offset-black/20",
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
        // 원형 — 아이콘만 있는 버튼(size="icon") 전용. 글자 버튼은 전부 block(2026-10-09 TDS 대조: 모서리 체계 하나).
        pill: "rounded-full",
        // 카드·폼 안의 버튼
        // 글자 버튼 전부 — 히어로·카드·폼·띠 구분 없이.
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
     * (weak의 다크용 primary-lighter 글씨가 흰 카드 위에서 1.6:1로 흐려진다). `Field`의 `light` 옵트인과 같은 처방.
     *
     * 실제로 라이트 고정 화면에서 쓰이는 variant만 되돌린다(solid·weak·ghost·secondary).
     * kakao·scrim은 그 화면에 없다.
     */
    compoundVariants: [
      {
        light: true,
        variant: "solid",
        class: "dark:focus-visible:ring-primary/70 dark:focus-visible:ring-offset-white",
      },
      {
        light: true,
        variant: "weak",
        class: "dark:bg-primary/10 dark:text-primary-dark dark:hover:bg-primary/15 dark:focus-visible:ring-primary/70 dark:focus-visible:ring-offset-white",
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
