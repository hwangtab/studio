import { useEffect, useState, type RefObject } from 'react';

/**
 * 본문의 카톡 블록(ContactCTA·KakaoSectionBar)이 화면에 보이는 동안 떠 있는 카톡 버튼(하단 바·FAB·스토리 고정 바)을
 * 숨기기 위한 신호. 한 화면에 같은 카톡 버튼이 셋 뜨면 무엇을 눌러야 할지 흐려진다(TDS: 화면당 주 행동 하나, 2026-10-09).
 *
 * 블록이 스스로 보임 여부를 알린다 — 동적 import로 늦게 붙는 블록도 놓치지 않는다. 보이는 블록 수를 모듈 전역으로 세고
 * window 이벤트로 알린다(컨텍스트를 Layout 바깥까지 끌어올리지 않기 위해서).
 */
const EVENT = 'studio:kakao-block-visibility';
let visibleCount = 0;

const emit = () => window.dispatchEvent(new CustomEvent(EVENT, { detail: visibleCount > 0 }));

/** 카톡 블록 쪽: 루트 요소 ref를 넘기면 보이는 동안 신호를 켠다. */
export function useReportKakaoBlock(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return;
    let counted = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted) {
          counted = true;
          visibleCount += 1;
          emit();
        } else if (!entry.isIntersecting && counted) {
          counted = false;
          visibleCount -= 1;
          emit();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (counted) {
        visibleCount -= 1;
        emit();
      }
    };
  }, [ref, enabled]);
}

/** 떠 있는 카톡 버튼 쪽: 본문 카톡 블록이 지금 보이는가. */
export function useKakaoBlockInView(): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setInView(Boolean((e as CustomEvent<boolean>).detail));
    setInView(visibleCount > 0);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return inView;
}
