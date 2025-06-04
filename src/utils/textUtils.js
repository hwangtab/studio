// 텍스트 유틸리티 함수

/**
 * 텍스트를 간단히 요약하는 함수
 * @param {string} text - 요약할 텍스트
 * @param {number} maxLength - 최대 길이
 * @returns {string} 요약된 텍스트
 */
export function summarizeText(text, maxLength = 100) {
  if (!text) return '';
  
  if (text.length <= maxLength) return text;
  
  // 문장 경계에서 자르기
  const lastSpaceIndex = text.lastIndexOf(' ', maxLength);
  const summary = text.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
  
  return summary + (text.length > maxLength ? '...' : '');
}