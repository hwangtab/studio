export const formatDate = (date: string | Date, format: string = 'YYYY년 MM월 DD일'): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day);
};

export const timeAgo = (date: string | Date): string => {
  return formatDate(date, 'YYYY년 MM월 DD일');
};
