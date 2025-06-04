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

// 마크다운 및 HTML 태그 제거
const removeMarkdown = (content) => {
  if (!content) return '';
  
  // 마크다운 코드 블록 제거
  let result = content.replace(/^```[\s\S]*?```/gm, '');
  // 마크다운 링크 제거
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // 마크다운 강조 제거
  result = result.replace(/(\*\*|__)(.*?)\1/g, '$2');
  result = result.replace(/(\*|_)(.*?)\1/g, '$2');
  // HTML 태그 제거
  result = result.replace(/<[^>]+>/g, '');
  // 여러 공백을 하나로 줄임
  return result.replace(/\s+/g, ' ').trim();
};

// 내용 요약 (문장 단위로 자름)
const summarizeContent = (content, maxLength = 100) => {
  if (!content) return '';
  
  const cleanContent = removeMarkdown(content);
  if (cleanContent.length <= maxLength) return cleanContent;
  
  // 문장 경계에서 자르기
  const lastSpaceIndex = cleanContent.lastIndexOf(' ', maxLength);
  const summary = cleanContent.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
  
  return summary + (cleanContent.length > maxLength ? '...' : '');
};

export {
  getAllStories,
  getStoriesByCategory,
  getStoryById,
  removeMarkdown,
  summarizeContent
};
