import { useEffect, useId, useState } from 'react';

interface Message {
  name: string;
  message: string;
  at: number;
}

/**
 * 한 메시지가 화면에 머무는 시간.
 *
 * 1.5~2초로 두면 두 줄짜리 메시지를 읽다 만다 — 읽히지 않는 글은 의욕을 높이는 대신
 * 산만하기만 하다. 실제로 들어온 메시지 중 가장 긴 것이 40자를 넘는다.
 */
const ROTATE_MS = 5500;

/**
 * 히어로 바로 아래에서 응원 메시지를 한 개씩 순환시킨다.
 *
 * 같은 메시지를 본문 아래 `BackerWall`이 전체 목록으로 한 번 더 보여준다. 여기는 "지금
 * 사람들이 함께하고 있다"를 첫 화면에서 알리는 자리이고, 전문·날짜·이름 나열은 그쪽이 맡는다.
 *
 * 메시지는 후원자가 쓴 글이다. `dangerouslySetInnerHTML`을 쓰지 않으므로 React가 텍스트
 * 노드로 이스케이프한다. `min-w-0` + `break-words`도 필요하다 — 공백 없는 긴 문자열 하나가
 * 카드를 밀어내 가로 스크롤을 만든다(BackerWall이 같은 이유로 같은 처리를 한다).
 */
export default function SupporterTicker({ messages }: { messages: Message[] }) {
  const uid = useId();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const count = messages.length;

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

  const rotating = count > 1 && !reducedMotion && !paused && !hovered;

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating, count]);

  // 메시지가 없으면 자리 자체를 만들지 않는다 — 히어로 바로 아래에 빈 상자를 두면
  // "아직 아무도 후원하지 않았다"가 첫 화면에 박힌다.
  if (count === 0) return null;

  const current = messages[Math.min(index, count - 1)];

  return (
    <section
      aria-labelledby={`${uid}-label`}
      // 자동으로 바뀌는 동안 읽어 주면 화면을 보지 않는 사람에게는 페이지가 5.5초마다
      // 끊긴다. 멈춘 뒤의 변화는 사용자가 스스로 넘긴 결과이므로 그때는 읽어 준다.
      aria-live={rotating ? 'off' : 'polite'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="glass-card rounded-2xl p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p
          id={`${uid}-label`}
          className="typo-card-meta font-semibold uppercase tracking-wider text-primary dark:text-primary-lighter"
        >
          응원 메시지
        </p>

        {count > 1 && (
          <div className="flex shrink-0 items-center gap-2">
            {!reducedMotion && (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? '응원 메시지 자동 넘김 재생' : '응원 메시지 자동 넘김 일시정지'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:text-gray-400 dark:focus-visible:ring-primary-lighter/70 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <span aria-hidden="true" className="text-xs leading-none">
                  {paused ? '▶' : '❙❙'}
                </span>
              </button>
            )}
            <span className="flex items-center gap-1.5">
              {messages.map((m, i) => (
                <button
                  key={`${m.at}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}번째 응원 메시지 보기`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`h-1.5 rounded-full transition-[width,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-lighter/70 ${
                    i === index
                      ? 'w-4 bg-primary dark:bg-primary-lighter'
                      : 'w-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
                  }`}
                />
              ))}
            </span>
          </div>
        )}
      </div>

      {/*
        높이를 고정한다. 메시지 길이가 제각각이라 카드가 늘었다 줄었다 하면 그 아래 본문
        전체가 들썩인다(CLS). 넘치는 메시지는 세 줄에서 자르고 전문은 BackerWall에서 읽는다.

        128px은 세 줄이 다 들어가는 값이다 — leading-7(28px) × 3줄 + 이름 줄(20px) + 간격
        (8px) = 112px. 실제로 들어온 가장 긴 메시지가 48자이고, 모바일 카드 폭에서 세 줄이다.
      */}
      <div className="mt-3 flex h-32 flex-col justify-center">
        <blockquote className="typo-card-body line-clamp-3 min-w-0 break-words leading-7">
          {current.message}
        </blockquote>
        <p className="typo-card-meta mt-2 min-w-0 break-words">— {current.name}</p>
      </div>
    </section>
  );
}
