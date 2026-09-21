import { useEffect, useRef, useId, useState } from 'react';

interface Message {
  name: string;
  message: string;
  at: number;
}

/**
 * 한 메시지가 화면에 머무는 시간.
 *
 * 짧다. 대신 두 줄에서 자르고, 더 읽고 싶으면 '더 보기'로 펼치거나 일시정지한다 — 큰 글씨·
 * 두 줄 자르기·빠른 순환·펼치기가 한 벌로 움직이는 설계다(saf-2026). 주기만 늘리면 큰
 * 글씨가 한자리에 오래 멈춰 있어 전광판이 아니라 그냥 인용 카드가 된다.
 */
const ROTATE_MS = 1500;

const PauseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
    <rect x="6" y="5" width="4" height="14" />
    <rect x="14" y="5" width="4" height="14" />
  </svg>
);

const PlayIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
    <path d="M8 5v14l11-7z" />
  </svg>
);

/**
 * 히어로 아래에서 응원 메시지를 한 개씩 순환시키는 전광판.
 *
 * 같은 메시지를 본문 아래 `BackerWall`이 전체 목록으로 한 번 더 보여준다. 여기는 "지금
 * 사람들이 함께하고 있다"를 첫 화면에서 알리는 자리이고, 전문·날짜·이름 나열은 그쪽이 맡는다.
 *
 * **글씨가 크다(모바일 text-2xl · 데스크톱 text-3xl, font-black).** 본문 크기(16px·weight
 * 300)로 두면 카드 안에서 눈에 띄지 않아 읽히지 않고, 읽히지 않는 응원은 후원을 부르지
 * 못한다. 카드가 아니라 인용문처럼 보이게 하는 것이 목적이다.
 *
 * 메시지는 후원자가 쓴 글이다. `dangerouslySetInnerHTML`을 쓰지 않으므로 React가 텍스트
 * 노드로 이스케이프한다. `break-keep`은 한글 단어를 중간에서 끊지 않게 한다.
 */
export default function SupporterTicker({ messages }: { messages: Message[] }) {
  const uid = useId();
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  const count = messages.length;
  // 펼쳐 읽는 동안에도 멈춘다 — 읽는 중에 넘어가면 펼친 의미가 없다.
  const paused = userPaused || expanded;

  /**
   * 서버 렌더와 클라이언트 첫 렌더는 항상 `false`로 시작해야 한다 — 마크업이 갈리면
   * 하이드레이션이 깨진다. 그래서 effect에서만 실제 값을 읽는다.
   */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const rotating = count > 1 && !reducedMotion && !paused;

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
      setExpanded(false);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating, count]);

  // 두 줄을 넘겨 잘렸는지는 CSS가 아니라 실제 DOM 높이로만 알 수 있다. 잘리지 않았는데
  // '더 보기'를 두면 눌러도 아무 일이 없는 버튼이 된다.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setIsClamped(el.scrollHeight > el.clientHeight + 1);
  }, [index, messages, expanded]);

  // 메시지가 없으면 자리 자체를 만들지 않는다 — 히어로 아래에 빈 상자를 두면
  // "아직 아무도 후원하지 않았다"가 첫 화면에 박힌다.
  if (count === 0) return null;

  const current = messages[Math.min(index, count - 1)];
  // 순환이 실제로 도는 경우에만 일시정지를 노출한다(WCAG 2.2.2). 돌지 않는데 버튼만 있으면
  // 멈출 것이 없는 버튼이다.
  const showPause = count > 1 && !reducedMotion;

  return (
    <section aria-labelledby={`${uid}-label`}>
      <h2 id={`${uid}-label`} className="typo-card-title text-gray-900 dark:text-white">
        응원 메시지
      </h2>

      {/*
        높이를 고정한다. 메시지 길이가 제각각이라 카드가 늘었다 줄었다 하면 그 아래 본문
        전체가 들썩인다(CLS). 펼쳤을 때만 h-auto로 풀고, 그때는 사용자가 스스로 연 것이라
        움직임이 예상 밖이 아니다.
      */}
      <div
        className={`glass-card relative mt-4 flex flex-col justify-center overflow-hidden rounded-2xl p-6 transition-[height] duration-base ease-standard md:p-8 ${
          expanded ? 'h-auto' : 'h-40 md:h-44'
        }`}
        // 자동으로 바뀌는 동안 읽어 주면 화면을 보지 않는 사람에게는 페이지가 1.5초마다
        // 끊긴다. 멈춘 뒤의 변화는 사용자가 스스로 넘긴 결과이므로 그때는 읽어 준다.
        aria-live={paused ? 'polite' : 'off'}
      >
        {showPause && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? '응원 메시지 자동 넘김 재생' : '응원 메시지 자동 넘김 일시정지'}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white/70 text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400 dark:focus-visible:ring-primary-lighter/70 dark:hover:text-white"
          >
            {userPaused ? <PlayIcon /> : <PauseIcon />}
          </button>
        )}

        <blockquote key={index} className="m-0">
          <p
            ref={contentRef}
            className={`break-keep font-title text-2xl font-black leading-tight tracking-tight text-gray-900 dark:text-white md:text-3xl ${
              expanded ? '' : 'line-clamp-2'
            }`}
          >
            &ldquo;{current.message}&rdquo;
          </p>
          <footer className="typo-card-meta mt-3 flex items-center justify-between gap-4 pb-1">
            <span className="min-w-0 break-words">— {current.name}</span>
            {isClamped && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="shrink-0 rounded font-semibold text-primary transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:text-primary-lighter dark:focus-visible:ring-primary-lighter/70 dark:hover:text-white"
              >
                {expanded ? '접기' : '더 보기'}
              </button>
            )}
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
