/**
 * 계약 관련 날짜·금액 표기.
 *
 * ## 시간대를 못박는 이유
 *
 * 서버(Vercel)는 UTC로 돌고 관리자 브라우저는 KST다. 시간대를 지정하지 않으면 같은 순간이
 * 실행되는 곳에 따라 다르게 찍힌다 — 밤 12시 30분에 받은 서명이 PDF와 메일에는 "전날 오후
 * 3시 30분"으로, 관리자 화면에는 "당일 오전 12시 30분"으로 나온다. 서명 시각은 이 문서가
 * 증명하려는 것의 핵심이고, 고객이 받은 계약서와 운영자 화면이 다른 날짜를 말하면 문의가
 * 왔을 때 어느 쪽이 맞는지 설명할 수가 없다.
 *
 * 계약은 한국에서 한국 시간으로 맺으므로 표기도 KST 하나로 고정한다. 서버와 브라우저가
 * 같은 함수를 쓰면 관리자 화면에서 서버 렌더 값과 하이드레이션 후 값이 달라지는 것도 사라진다.
 *
 * 계약 기간(startDate·endDate)은 시각이 아니라 날짜라 UTC 자정으로 저장되고, KST로 읽어도
 * 같은 날이다. 그래도 같은 함수를 쓴다 — 표기 규칙이 한 군데에 있어야 어긋나지 않는다.
 */

const TIME_ZONE = 'Asia/Seoul';
const LOCALE = 'ko-KR';

type DateLike = string | Date | null | undefined;

const toDate = (value: DateLike): Date | null => {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
};

const partsOf = (date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> => {
  const parts = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...options }).formatToParts(
    date,
  );
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
};

/** 2026년 9월 1일 */
export const formatDate = (value: DateLike, fallback = '-'): string => {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/** 2026. 09. 01. — 목록처럼 폭이 좁은 자리용 */
export const formatShortDate = (value: DateLike, fallback = '-'): string => {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * 2026.09.01 — 표 셀 안에서 한 줄에 담겨야 하는 자리용.
 *
 * "2026년 9월 1일 ~ 2027년 3월 1일"은 좁은 화면의 셀에서 "2027년 3월 / 1일"로 쪼개져
 * 날짜를 잘못 읽기 쉽다. 계약 기간은 오독이 곧 분쟁이라 한 줄에 담기는 형태가 낫다.
 */
export const formatCompactDate = (value: DateLike, fallback = '-'): string => {
  const date = toDate(value);
  if (!date) return fallback;
  const { year, month, day } = partsOf(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return `${year}.${month}.${day}`;
};

/**
 * 2026년 9월 1일 오후 03:30
 *
 * 오전·오후를 로케일 데이터에서 가져오지 않고 직접 만든다.
 *
 * toLocaleString에 맡겼더니 Vercel 런타임에서 "2026년 9월 1일 PM 03:19"가 나왔다 — 날짜는
 * 한국어인데 오전/오후만 영어인 상태다. 그쪽 ICU에 한국어 dayPeriod가 없어서인데, 같은
 * 함수가 브라우저에서는 "오후 03:19"를 내므로 관리자 화면 한 장에 두 표기가 섞였다.
 * 계약서 PDF의 서명 일시도 서버에서 만들어지니 같은 증상이었다.
 *
 * 시각은 이 문서가 증명하려는 것의 핵심이라, 어디서 렌더하든 한 글자도 달라지면 안 된다.
 * 24시간제로 숫자만 받아 오전/오후와 12시간 표기를 손으로 계산하면 로케일 데이터가
 * 무엇이든 결과가 같다. 날짜 부분은 formatDate를 그대로 쓴다 — 월 표기는 양쪽에서
 * 정상이었고, 표기 규칙을 한 군데에 두려는 이 파일의 원칙과도 맞는다.
 */
export const formatDateTime = (value: DateLike, fallback = '-'): string => {
  const date = toDate(value);
  if (!date) return fallback;

  const { hour, minute } = partsOf(date, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const hour24 = Number(hour);
  const period = hour24 < 12 ? '오전' : '오후';
  // 0시는 오전 12시, 12시는 오후 12시다. 나머지는 12로 나눈 나머지.
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${formatDate(date)} ${period} ${String(hour12).padStart(2, '0')}:${minute}`;
};

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat(LOCALE).format(amount);
