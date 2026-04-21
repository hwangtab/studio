// 서버(UTC)와 클라이언트(KST=UTC+9 등)의 타임존 차이로 인한 React hydration
// 불일치(React #418)를 막기 위해 UTC 메서드/옵션으로 날짜를 안정적으로 렌더한다.
// 스토리 frontmatter의 date가 ISO UTC로 저장되므로 UTC 기준 표시가 의미적으로도 자연스러움.
export const formatDate = (date: string | Date, locale: string = 'ko'): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  if (locale === 'ko') {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');

    return `${year}년 ${month}월 ${day}일`;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  }
};

export const timeAgo = (date: string | Date, locale: string = 'ko'): string => {
  return formatDate(date, locale);
};
