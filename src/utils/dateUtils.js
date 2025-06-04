/**
 * 날짜 포맷팅 유틸리티 함수
 * @param {string|Date} date - 포맷팅할 날짜 (문자열 또는 Date 객체)
 * @param {string} format - 포맷 문자열 (기본값: 'YYYY-MM-DD')
 * @returns {string} 포맷팅된 날짜 문자열
 */
export const formatDate = (date, format = 'YYYY년 MM월 DD일') => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
};

/**
 * 날짜를 YYYY-MM-DD 형식으로 표시
 * @param {string|Date} date - 포맷팅할 날짜
 * @returns {string} 포맷팅된 날짜 문자열 (YYYY-MM-DD)
 */
export const timeAgo = (date) => {
  return formatDate(date, 'YYYY년 MM월 DD일');
};