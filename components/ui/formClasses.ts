/**
 * 폼 입력 재질의 단일 정의. 예약(BookingWizard)·믹싱 주문(MixingOrderWizard)·
 * 펀딩 후원(PledgeWizard) 세 위저드가 같은 문자열을 각자 들고 있었는데, 한 곳만
 * 고치면 나머지 두 폼이 조용히 달라진다 — 사이트 안에서 폼은 한 벌로 읽혀야 한다.
 * 값은 기존 세 복제본과 완전히 동일하다(동작·렌더 불변).
 */
export const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent';
