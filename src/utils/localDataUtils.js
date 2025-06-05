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
      
      // 2. 동일 날짜 시 파일명(id) 기준 오름차순
      return (a.id || '').localeCompare(b.id || '');
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

// 내용 요약 (문장 단위로 자름)
const summarizeContent = (content, maxLength = 100) => {
  if (!content) return '';
  
  // 첫 번째 문장 또는 최대 길이까지 자르기
  const firstLine = content.split('\n')[0];
  if (firstLine.length <= maxLength) return firstLine;
  
  // 문장 경계에서 자르기
  const lastSpaceIndex = firstLine.lastIndexOf(' ', maxLength);
  const summary = firstLine.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
  
  return summary + (firstLine.length > maxLength ? '...' : '');
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
  getRelatedStories
};
