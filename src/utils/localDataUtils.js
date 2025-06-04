// 파일 시스템 기반 데이터 관리 유틸리티

// 모든 스토리 가져오기
const getAllStories = async () => {
  try {
    const response = await fetch('/data/stories.json');
    if (!response.ok) {
      throw new Error('스토리 데이터를 불러오지 못했습니다.');
    }
    return await response.json();
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

export {
  getAllStories,
  getStoriesByCategory,
  getStoryById,
  summarizeContent
};
