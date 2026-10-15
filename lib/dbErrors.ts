/**
 * `no such table` 오류인가 — 마이그레이션 전 배포에서 표가 없는 정상 상황을 장애와 가른다.
 * drizzle 0.45는 libsql 오류를 감싸 던져 문구가 `error.cause`에 있으므로 cause 사슬을 따라 내려간다
 * (String(error)·error.message만 보면 놓친다). `table`을 주면 그 표가 없는 경우만 참이다(다른 표가 없는 것까지 삼키지 않게).
 */
export const isMissingTableError = (error: unknown, table?: string): boolean => {
  const seen = new Set<unknown>();
  let cur: unknown = error;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const msg = cur instanceof Error ? cur.message : typeof cur === 'string' ? cur : '';
    if (/no such table/i.test(msg) && (!table || msg.includes(table))) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
};
