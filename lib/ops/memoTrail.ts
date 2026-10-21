/**
 * 수기 매출·지출 메모 끝에 붙는 **변경 기록 줄**(`[환불 …]`·`[분야 변경 …]`·`[구분 …]`·`[항목 …]`·`[중복 아님] …`)을 다루는 순수 함수.
 * 이 표들에는 수정 이력 칸이 없어 메모 끝 줄이 이력이다(manualRevenue.ts·expenses.ts).
 *
 * 규칙(2026-10-21 감사):
 * - 길이 상한을 넘으면 **가장 오래된 기록 줄부터** 버린다. 운영자가 처음 적은 메모(머리)는 건드리지 않는다.
 * - `[중복 아님]` 줄은 버리지 않는다 — 지워지면 운영 점검이 이미 확인한 건을 다시 묻는다.
 * - 기록 줄을 다 버려도 넘치면(머리 자체가 거의 상한일 때) 그때만 머리를 줄이고 `…`을 붙인다. 새 줄은 항상 남는다.
 */
export const MEMO_LIMIT = 2000;
export const DUPLICATE_ACK_MARKER = '[중복 아님]';

const TRAIL_PREFIXES = ['[환불 ', '[분야 변경 ', '[구분 ', '[항목 ', DUPLICATE_ACK_MARKER] as const;

export const isTrailLine = (line: string): boolean => TRAIL_PREFIXES.some((p) => line.startsWith(p));

export const appendMemoLine = (memo: string | null, line: string, limit: number = MEMO_LIMIT): string => {
  const lines = memo ? memo.split('\n') : [];
  const firstTrail = lines.findIndex(isTrailLine);
  const history = firstTrail === -1 ? [] : lines.slice(firstTrail);
  let head = (firstTrail === -1 ? lines : lines.slice(0, firstTrail)).join('\n');
  const build = () => [head, ...history, line].filter((s) => s !== '').join('\n');

  while (build().length > limit) {
    const oldest = history.findIndex((h) => !h.includes(DUPLICATE_ACK_MARKER));
    if (oldest === -1) break;
    history.splice(oldest, 1);
  }
  if (build().length > limit && head !== '') {
    const rest = [...history, line].join('\n');
    const room = limit - rest.length - 1; // 머리와 나머지 사이 줄바꿈 하나
    head = room >= 2 ? `${head.slice(0, room - 1)}…` : '';
  }
  return build();
};

/** 낙관적 쓰기가 다른 요청에 먼저 밀렸다는 표시. */
export const MEMO_CONFLICT = Symbol('memo_conflict');

/**
 * 메모 덧붙이기는 "읽고 → 계산 → `WHERE memo IS <읽은 값>`으로 쓰기"다. 그 사이 다른 요청이 메모를 바꿨으면 0행이 갱신되고,
 * 호출부가 `MEMO_CONFLICT`를 돌려주면 다시 읽어 계산한다(기본 3번). 끝내 밀리면 던진다 — 조용히 한 줄을 잃지 않는다.
 */
export const retryOnMemoConflict = async <T>(attempt: () => Promise<T | typeof MEMO_CONFLICT>, tries = 3): Promise<T> => {
  for (let i = 0; i < tries; i += 1) {
    const result = await attempt();
    if (result !== MEMO_CONFLICT) return result;
  }
  throw new Error('memo_conflict');
};
