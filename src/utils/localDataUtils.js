// 파일 시스템 기반 데이터 관리 유틸리티

// 모든 스토리 가져오기
const getAllStories = async () => {
  try {
    const response = await fetch('/data/stories.json');
    if (!response.ok) throw new Error('스토리 데이터 불러오기 실패');
    
    const stories = await response.json();
    // 정렬 함수
    const compareStories = (a, b) => {
      // createdAt이 없는 경우를 대비한 fallback (오늘 자정)
      const getDate = (story) => {
        if (story.createdAt) return new Date(story.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      };
      
      const dateA = getDate(a);
      const dateB = getDate(b);
      
      // 1. 날짜 기준 내림차순 (최신순)
      const dateCompare = dateB - dateA;
      if (dateCompare !== 0) return dateCompare;
      
      // 2. 동일 날짜 시 파일명(id) 기준 내림차순
      return (b.id || '').localeCompare(a.id || '');
    };
    
    return [...stories].sort(compareStories);
  } catch (error) {
    console.error('스토리 데이터 로딩 오류:', error);
    return [];
  }
};

// 카테고리별 스토리 가져오기
const getStoriesByCategory = async (category) => {
  try {
    const stories = await getAllStories();
    return category === 'all' ? stories : stories.filter(story => story.category === category);
  } catch (error) {
    console.error('카테고리별 스토리 로딩 오류:', error);
    return [];
  }
};

// 특정 스토리 가져오기
const getStoryById = async (id) => {
  try {
    const stories = await getAllStories();
    return stories.find(story => story.id === id);
  } catch (error) {
    console.error('특정 스토리 로딩 오류:', error);
    return null;
  }
};

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
const getRelatedStories = async (currentId) => {
  try {
    const stories = await getAllStories();
    return stories
      .filter(story => story.id !== currentId)
      .slice(0, 3);
  } catch (error) {
    console.error('관련 스토리 로딩 오류:', error);
    return [];
  }
};

export {
  getAllStories,
  getStoriesByCategory,
  getStoryById,
  summarizeContent,
  getRelatedStories,
  extractFirstImageUrl,
  stripMarkdown
};
