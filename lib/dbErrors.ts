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

/**
 * UNIQUE(또는 PRIMARY KEY) 제약 위반인가 — 동시 요청의 두 번째 쓰기를 DB가 막았다는 신호를 장애와 가른다.
 *
 * **`cause` 사슬을 따라간다.** drizzle 0.45는 단일 문장 쿼리의 오류를 `DrizzleQueryError("Failed query: …")`로 감싸고
 * sqlite 원문(`UNIQUE constraint failed: <표>.<칸>`)을 `cause`에만 싣는다(`db.batch`는 원문이 message에 있다).
 * `String(error).includes('UNIQUE')`나 `error.message`만 보는 판정은 감싼 오류에서 **항상 false**다 — 토스 웹훅의 중복
 * 이벤트가 500으로 떨어져 재시도가 끝없이 오던 원인이다(코드리뷰 2026-10-09 PAY-3·DB-7, 2026-10-22 고침).
 * `code`로 판정하지 말 것 — 이 스택의 code는 `SQLITE_CONSTRAINT`로 NOT NULL·CHECK·FK와 구별되지 않는다.
 *
 * `qualifiedColumn`(`표.칸`)을 주면 그 칸의 위반만 참이다(다른 유일 제약 위반을 같은 뜻으로 삼키지 않게).
 */
export const isUniqueConstraintError = (error: unknown, qualifiedColumn?: string): boolean => {
  const pattern = qualifiedColumn
    ? new RegExp(`UNIQUE constraint failed: [^\\n]*\\b${qualifiedColumn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    : /UNIQUE constraint failed/i;
  const seen = new Set<unknown>();
  let cur: unknown = error;
  for (let depth = 0; cur && !seen.has(cur) && depth < 6; depth += 1) {
    seen.add(cur);
    const msg = cur instanceof Error ? cur.message : typeof cur === 'string' ? cur : '';
    if (pattern.test(msg)) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
};
