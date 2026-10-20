/**
 * 세션 연주자 등록 — 폼·검증·관리자 필터가 함께 쓰는 목록(악기·장르·지역·악보 리딩).
 *
 * 한 곳에 둔 이유: 폼의 선택지와 서버 검증, 관리자 필터가 따로 베낀 목록을 쓰면 한쪽에만 있는 값이 생겨
 * 저장은 되는데 화면에 코드(영문 id)가 그대로 찍히거나, 검증이 정상 입력을 거절한다.
 * 설계: docs/session-musician-registration-design-2026-10.md
 *
 * **id는 DB에 저장되므로 바꾸지 않는다.** 이름(label)만 고친다. 목록에서 빼려면 id를 남겨 둔 채 `retired`로 표시한다.
 */

export interface SessionOption {
  readonly id: string;
  readonly label: string;
}

export const SESSION_INSTRUMENTS: readonly SessionOption[] = [
  { id: 'vocal', label: '보컬' },
  { id: 'chorus', label: '코러스' },
  { id: 'acoustic-guitar', label: '어쿠스틱 기타' },
  { id: 'electric-guitar', label: '일렉트릭 기타' },
  { id: 'bass', label: '일렉 베이스' },
  { id: 'upright-bass', label: '콘트라베이스' },
  { id: 'drums', label: '드럼' },
  { id: 'percussion', label: '퍼커션' },
  { id: 'piano', label: '피아노' },
  { id: 'keyboard', label: '키보드·신시사이저' },
  { id: 'violin', label: '바이올린' },
  { id: 'viola', label: '비올라' },
  { id: 'cello', label: '첼로' },
  { id: 'flute', label: '플루트' },
  { id: 'clarinet', label: '클라리넷' },
  { id: 'saxophone', label: '색소폰' },
  { id: 'trumpet', label: '트럼펫' },
  { id: 'trombone', label: '트롬본' },
  { id: 'horn', label: '호른' },
  { id: 'harmonica', label: '하모니카' },
  { id: 'traditional', label: '국악기' },
  { id: 'other', label: '그 밖의 악기' },
];

export const SESSION_GENRES: readonly SessionOption[] = [
  { id: 'ballad', label: '발라드' },
  { id: 'pop', label: '팝' },
  { id: 'rock', label: '록' },
  { id: 'indie', label: '인디' },
  { id: 'folk', label: '포크·어쿠스틱' },
  { id: 'hiphop-rnb', label: '힙합·R&B' },
  { id: 'jazz', label: '재즈' },
  { id: 'electronic', label: '일렉트로닉' },
  { id: 'trot', label: '트로트' },
  { id: 'ccm', label: 'CCM·가스펠' },
  { id: 'ost', label: 'OST·영상 음악' },
  { id: 'classical', label: '클래식·크로스오버' },
  { id: 'world', label: '월드·국악' },
];

export const SESSION_READING_OPTIONS: readonly SessionOption[] = [
  { id: 'chart', label: '코드 차트' },
  { id: 'staff', label: '오선보' },
  { id: 'none', label: '악보 없이 귀로' },
];

/** 스튜디오 방문 가능 지역(시·도). 모르면 비워 둘 수 있다. */
export const SESSION_REGIONS: readonly string[] = [
  '서울',
  '경기',
  '인천',
  '강원',
  '충북',
  '충남·대전·세종',
  '전북',
  '전남·광주',
  '경북·대구',
  '경남·부산·울산',
  '제주',
];

export const SESSION_STATUS_LABEL = {
  new: '새 등록',
  reviewed: '확인함',
  active: '섭외 후보',
  inactive: '내림',
} as const;

/** 입력 한도 — 폼(maxLength)과 서버 검증이 같은 값을 읽는다. */
export const SESSION_LIMITS = {
  stageName: { min: 1, max: 40 },
  realName: { min: 2, max: 50 },
  bio: { max: 1000 },
  rateNote: { max: 200 },
  kakaoId: { max: 50 },
  otherInstrument: { max: 30, count: 5 },
  sampleLinks: { min: 1, max: 5 },
  sampleLabel: { max: 60 },
  sampleUrl: { max: 2048 },
  yearsExperience: { min: 0, max: 70 },
  email: { max: 254 },
  operatorMemo: { max: 2000 },
} as const;

const labelOf = (options: readonly SessionOption[], id: string): string =>
  options.find((option) => option.id === id)?.label ?? id;

export const instrumentLabel = (id: string): string => labelOf(SESSION_INSTRUMENTS, id);
export const genreLabel = (id: string): string => labelOf(SESSION_GENRES, id);
export const readingLabel = (id: string | null | undefined): string => (id ? labelOf(SESSION_READING_OPTIONS, id) : '');

export const isInstrumentId = (id: unknown): id is string =>
  typeof id === 'string' && SESSION_INSTRUMENTS.some((option) => option.id === id);
export const isGenreId = (id: unknown): id is string =>
  typeof id === 'string' && SESSION_GENRES.some((option) => option.id === id);

/** 보유 기간 — 마지막 확인일(등록·수정·재확인 중 나중)부터 2년. 처리방침 3항·18항 ⑯과 같은 약속이다(바꾸면 셋을 함께). */
export const SESSION_RETENTION_YEARS = 2;
/** 보유 만료 3개월 전(1년 9개월째)에 "아직 세션 연주 하세요?" 메일을 한 번 보낸다. */
export const SESSION_RECONFIRM_AFTER_MONTHS = 21;

/** 등록 폼의 동의 요약 4줄 — 항목·목적·보유 기간·거부 권리와 불이익. 처리방침 전체가 아니라 이 수집 목적의 요약이다. */
export const SESSION_CONSENT_SUMMARY: ReadonlyArray<{ label: string; text: string }> = [
  {
    label: '수집 항목',
    text: '활동명, 실명, 휴대전화, 이메일, 카카오톡 ID(선택), 악기·장르·경력·소개·샘플 링크·희망 단가 메모(선택) 등 위에 적은 내용',
  },
  {
    label: '이용 목적',
    text: '녹음·편곡·발매 프로젝트에 맞는 세션 연주자를 찾아 섭외 의사를 묻는 연락. 사이트에 공개하지 않고 운영자만 봐요.',
  },
  {
    label: '보유 기간',
    text: `마지막으로 확인한 날부터 ${SESSION_RETENTION_YEARS}년. 1년 9개월째에 계속 활동 중인지 메일로 한 번 물어요. 이메일로 받는 관리 링크에서 언제든 고치거나 지울 수 있어요.`,
  },
  {
    label: '동의 거부',
    text: '동의하지 않으실 수 있어요. 다만 동의하지 않으면 등록할 수 없어요.',
  },
];

/** 푸터 한 줄·/about 문단의 링크 문구. 헤더 메뉴에는 넣지 않는다(고객 동선이 아니다). ko 전용. */
export const SESSION_MUSICIAN_NAV_LABEL = '함께 일하기';
export const SESSION_MUSICIAN_PATH = '/ko/session-musicians';
