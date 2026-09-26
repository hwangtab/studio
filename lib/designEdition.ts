import { createContext, useContext } from 'react';

/**
 * 디자인 판(edition). 개편(v2)은 페이지 단위로 켠다.
 *
 * 페이지 컴포넌트에 `Page.designEdition = 'v2'`를 달면 `_app`이 이 컨텍스트와
 * wrapper의 `data-edition="v2"`를 내려보내고, SectionHeading·Footer처럼 공용이지만
 * 개편 대상인 컴포넌트가 여기서 분기한다. 그 밖의 공용 컴포넌트는 CSS 스코프
 * (`[data-edition='v2']`)로만 영향을 받는다 — 파일은 그대로다.
 *
 * 한 번에 전역으로 뒤집지 않는 이유: 공용 CTA·카드 컴포넌트가 진행 중인 전환 실험의
 * 계측 지점이라, 거기를 바꾸면 실험이 판정 불가가 된다(2026-09-25 디자인 회의).
 * v1 페이지가 정말 그대로인지는 scripts/visual/golden-html.mjs로 확인한다 —
 * v1에서는 data-edition 속성조차 붙지 않으므로 빌드 HTML이 글자 하나 달라지면 안 된다.
 */
export type DesignEdition = 'v1' | 'v2';

export const DesignEditionContext = createContext<DesignEdition>('v1');

export const useDesignEdition = (): DesignEdition => useContext(DesignEditionContext);
