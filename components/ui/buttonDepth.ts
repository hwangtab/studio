/**
 * 버튼 입체감 — 면 위에 얹는 은은한 세로 그라디언트 + 윗선 하이라이트 + 층진 그림자, 누르면 안쪽 그림자.
 *
 * 그라디언트는 배경색이 아니라 그 위의 반투명 레이어(background-image)라서 hover의 bg-color 전환이 그대로
 * 보간된다. 그림자는 Tailwind shadow-[...]로 둬 --tw-shadow에 들어가므로 포커스 링(ring-*)과 합성된다.
 * 테두리가 있는 버튼에 붙이지 말 것 — 투명 테두리 안쪽에 하이라이트가 그려져 이중 테두리가 된다.
 * 누르면 0.96배로 줄고 살짝 어두워진다 — 손으로 짠 버튼도 이 문자열 하나로 휴대폰 눌림 반응을 받는다.
 * 광택처럼 보이면 실패다 — 가까이서 봐야 알아챌 정도까지만(운영자 2026-10-08 "입체감을 줘서 클릭하고 싶게").
 */
export const BUTTON_DEPTH = {
  /** 파랑 solid 버튼. 라이트·다크 모두 같은 파랑 면이라 다크 반전은 없다. */
  solid:
    'active:scale-[0.96] active:brightness-90 bg-origin-border bg-[linear-gradient(180deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_60%)] ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(29_78_216/0.3),0_6px_16px_-6px_rgb(29_78_216/0.5)] ' +
    'hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.26),0_2px_4px_rgb(29_78_216/0.3),0_12px_24px_-8px_rgb(29_78_216/0.55)] ' +
    'active:shadow-[inset_0_2px_4px_rgb(15_23_42/0.35)] ' +
    'dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_16px_-6px_rgb(0_0_0/0.7)] ' +
    'dark:hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.26),0_12px_24px_-8px_rgb(0_0_0/0.8)]',
  /** 카카오 옐로. 윗부분을 밝히고 아랫선을 살짝 눌러 노랑이 평판으로 보이지 않게. */
  kakao:
    'active:scale-[0.96] active:brightness-90 bg-origin-border bg-[linear-gradient(180deg,rgb(255_255_255/0.32),rgb(255_255_255/0)_55%)] ' +
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.55),inset_0_-1px_0_rgb(120_100_0/0.18),0_1px_2px_rgb(25_22_0/0.18),0_6px_16px_-6px_rgb(25_22_0/0.35)] ' +
    'hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-1px_0_rgb(120_100_0/0.18),0_2px_4px_rgb(25_22_0/0.18),0_12px_24px_-8px_rgb(25_22_0/0.4)] ' +
    'active:shadow-[inset_0_2px_4px_rgb(25_22_0/0.25)]',
  /** 어두운 사진 위 흰 버튼. */
  inverse:
    'active:scale-[0.96] active:brightness-90 bg-origin-border bg-[linear-gradient(180deg,rgb(255_255_255/0),rgb(3_7_18/0.06))] ' +
    'shadow-[inset_0_-1px_0_rgb(3_7_18/0.12),0_1px_2px_rgb(0_0_0/0.3),0_8px_20px_-6px_rgb(0_0_0/0.5)] ' +
    'hover:shadow-[inset_0_-1px_0_rgb(3_7_18/0.12),0_2px_4px_rgb(0_0_0/0.3),0_14px_28px_-8px_rgb(0_0_0/0.6)] ' +
    'active:shadow-[inset_0_2px_4px_rgb(3_7_18/0.2)]',
} as const;
