/**
 * 사이트의 모든 소리는 한 번에 하나만 난다 — 글로벌 미니 플레이어, 믹싱 전·후 비교, 포트폴리오 플레이어가
 * 서로를 모른 채 겹쳐 울리지 않게 하는 아주 작은 버스(라이너 노트 §3-6, docs/design-liner-notes-plan-2026-10.md).
 *
 * 재생을 시작하는 쪽이 `announcePlay(source)`를 부르고, 나머지는 `onOtherPlay(source, cb)`로 구독해 자기 소리를
 * 멈춘다. DOM 이벤트(window)라 컴포넌트 트리·컨텍스트와 무관하고, SSR에서는 아무것도 하지 않는다.
 */
export const AUDIO_BUS_EVENT = 'studio-audio:play';

export type AudioSource = 'global' | 'mix-compare' | 'portfolio-player';

export const announcePlay = (source: AudioSource): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ source: AudioSource }>(AUDIO_BUS_EVENT, { detail: { source } }));
};

/** 다른 소스가 재생을 시작하면 cb. 반환값으로 구독을 해제한다. */
export const onOtherPlay = (self: AudioSource, cb: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (e: Event) => {
    const source = (e as CustomEvent<{ source: AudioSource }>).detail?.source;
    if (source && source !== self) cb();
  };
  window.addEventListener(AUDIO_BUS_EVENT, handler);
  return () => window.removeEventListener(AUDIO_BUS_EVENT, handler);
};
