/**
 * 개설자 편집 화면의 시작일·종료일 — `<input type="date">`(KST 달력 날짜, `YYYY-MM-DD`)와
 * 서버가 저장하는 `Date`(UTC epoch) 사이를 오간다.
 *
 * **한 방향으로만 변환한다.** 예전엔 저장할 때 `new Date(\`${v}T00:00:00\`)`(실행 환경의
 * 로컬 자정)로 보내고 읽을 때 `iso.slice(0, 10)`(UTC 문자열 절단)으로 읽었다 — KST에서
 * 로컬 자정은 UTC 15시라, 저장한 뒤 다시 읽으면 하루 전 날짜가 나왔다. 제목만 고쳐도
 * 기본정보 구획을 다시 저장하면 그 하루 밀린 날짜가 그대로 다시 저장돼, 저장할 때마다
 * 시작일이 하루씩 당겨졌다(2026-09-17 리뷰 지적).
 *
 * 여기서는 항상 **KST(UTC+9) 달력 날짜**를 기준으로 삼는다 — `Date.getTime()`(절대
 * epoch)에 9시간을 더한 뒤 UTC getter로 읽으면, 이 함수를 실행하는 서버·브라우저의
 * 시스템 타임존과 무관하게 항상 같은 결과가 나온다(`getFullYear()` 같은 로컬 포맷터를
 * 쓰지 않는 이유 — SSR은 대개 UTC, 브라우저는 대개 KST라 두 값이 갈려 하이드레이션
 * 불일치가 난다).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** 절대 시각 → 그 순간의 KST 달력 날짜(`YYYY-MM-DD`). */
export const toKstDateString = (date: Date): string => {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** KST 달력 날짜의 00:00:00+09:00을 가리키는 ISO 문자열. */
export const kstStartOfDayIso = (dateStr: string): string => `${dateStr}T00:00:00+09:00`;

/**
 * KST 달력 날짜의 23:59:59+09:00을 가리키는 ISO 문자열 — 개설자가 고른 마지막 날은
 * 하루 종일 열려 있어야 한다(content/funding/keep-singing-for-palestine.md의
 * `endAt: 2026-10-19T23:59:59+09:00`과 같은 관례).
 */
export const kstEndOfDayIso = (dateStr: string): string => `${dateStr}T23:59:59+09:00`;

/**
 * 개설자가 시작일로 고를 수 있는 가장 이른 KST 날짜.
 *
 * 서버 검증(`validateBasicSection`)은 `startAt(=그 날짜의 00:00+09:00) < now + leadDays일`이면
 * 거부한다. 그 조건을 만족하는 가장 이른 날짜를 그대로 계산해 `<input type="date" min=…>`과
 * 힌트 문구에 쓴다 — "3일 뒤부터"라는 상대 표현만 두면, 자정이 아니라 아무 시각에나 저장
 * 요청이 오므로 "오늘 + 3일"을 그대로 고르면 시:분:초가 남아 있어 거의 항상 거부된다
 * (2026-09-17 리뷰 지적). `now`는 GSSP가 요청 시각으로 넘겨 계산한다 — 브라우저의 현재
 * 시각으로 다시 계산하면 SSR과 CSR의 `now`가 갈려 하이드레이션 불일치가 난다.
 */
export const computeEarliestStartDate = (nowMs: number, leadDays: number): string => {
  const earliestInstant = nowMs + leadDays * DAY_MS;
  const candidate = toKstDateString(new Date(earliestInstant));
  const candidateMidnight = new Date(kstStartOfDayIso(candidate)).getTime();
  if (candidateMidnight >= earliestInstant) return candidate;
  return toKstDateString(new Date(candidateMidnight + DAY_MS));
};
