export const formatDate = (date: string | Date, locale: string = 'ko'): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  if (locale === 'ko') {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}년 ${month}월 ${day}일`;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }
};

export const timeAgo = (date: string | Date, locale: string = 'ko'): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (locale === 'ko') {
    if (diffSec < 60) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;
    if (diffWeek < 5) return `${diffWeek}주 전`;
    if (diffMonth < 12) return `${diffMonth}달 전`;
    return `${diffYear}년 전`;
  }

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diffSec < 60) return rtf.format(-diffSec, 'second');
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    if (diffHour < 24) return rtf.format(-diffHour, 'hour');
    if (diffDay < 7) return rtf.format(-diffDay, 'day');
    if (diffWeek < 5) return rtf.format(-diffWeek, 'week');
    if (diffMonth < 12) return rtf.format(-diffMonth, 'month');
    return rtf.format(-diffYear, 'year');
  } catch {
    return formatDate(date, locale);
  }
};
