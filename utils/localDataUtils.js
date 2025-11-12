// 스토리 콘텐츠에서 첫 번째 이미지 URL 추출
const extractFirstImageUrl = (content) => {
  if (!content) return null;
  
  // Markdown 이미지 패턴 매칭: ![alt text](url)
  const imageRegex = /!\[.*?\]\(([^)]+)\)/;
  const match = content.match(imageRegex);
  
  return match ? match[1] : null;
};

// Markdown을 평문 텍스트로 변환
const stripMarkdown = (content) => {
  if (!content) return '';
  
  return content
    // 이미지 제거
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    // 링크를 텍스트만 남기기
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 헤딩 제거
    .replace(/#{1,6}\s+/g, '')
    // 볼드/이탤릭 마크다운 제거
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 코드 블록 제거
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // 연속된 공백 및 개행 정리
    .replace(/\s+/g, ' ')
    .trim();
};

// 내용 요약 (평문 텍스트 기준)
const summarizeContent = (content, maxLength = 150) => {
  if (!content) return '';
  
  // Markdown을 평문으로 변환
  const plainText = stripMarkdown(content);
  
  if (plainText.length <= maxLength) return plainText;
  
  // 문장 경계에서 자르기
  const lastSpaceIndex = plainText.lastIndexOf(' ', maxLength);
  const summary = plainText.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
  
  return summary + '...';
};

// 관련 스토리 가져오기 (현재 스토리 제외 최신 3개)
export {
  summarizeContent,
  extractFirstImageUrl,
  stripMarkdown
};
