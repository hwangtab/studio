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
  return formatDate(date, locale);
};
