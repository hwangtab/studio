import { useState } from 'react';

interface Message {
  name: string;
  message: string;
  at: number;
}

const PAGE = 20;

const formatDate = (at: number): string => {
  const d = new Date(at * 1000);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 후원자 명단과 응원 메시지.
 *
 * 공개에 동의한 후원자만 들어온다(서버의 `display_name_public = 1`). 동의하지 않은 후원은
 * 이름을 가리는 것이 아니라 **아예 오지 않는다** — 가린 자리조차 남기지 않는다.
 *
 * 메시지는 후원자가 쓴 글이다. `dangerouslySetInnerHTML`을 쓰지 않으므로 React가 텍스트
 * 노드로 이스케이프한다. 그리고 `min-w-0` + `break-words`가 필요하다 — 공백 없는 긴 문자열
 * 하나가 카드를 밀어내 가로 스크롤을 만든다.
 */
export default function BackerWall({ names, messages }: { names: string[]; messages: Message[] }) {
  const [shown, setShown] = useState(PAGE);
  if (names.length === 0) return null;

  const visible = messages.slice(0, shown);

  return (
    <section aria-labelledby="backer-wall-heading" className="glass-card rounded-2xl p-6">
      <h2 id="backer-wall-heading" className="typo-card-subtitle text-gray-900 dark:text-white">
        함께한 후원자
      </h2>
      <p className="typo-card-body mt-3 break-words leading-7">{names.join(' · ')}</p>

      {visible.length > 0 && (
        <>
          <h3 className="typo-card-subtitle mt-8 text-gray-900 dark:text-white">남겨 주신 말</h3>
          <ul className="mt-4 space-y-3">
            {visible.map((m, i) => (
              <li
                key={`${m.name}-${m.at}-${i}`}
                className="rounded-xl border border-gray-200/80 bg-white/60 p-4 dark:border-gray-700/70 dark:bg-gray-800/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words font-semibold text-gray-900 dark:text-white">{m.name}</span>
                  <span className="typo-card-meta shrink-0">{formatDate(m.at)}</span>
                </div>
                <blockquote className="typo-card-body mt-2 min-w-0 whitespace-pre-line break-words">
                  {m.message}
                </blockquote>
              </li>
            ))}
          </ul>
          {shown < messages.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-gray-300 px-4 font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:ring-primary-lighter/70"
            >
              더 보기 ({messages.length - shown}개 남음)
            </button>
          )}
        </>
      )}
    </section>
  );
}
