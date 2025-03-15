// 로컬 스토리지 기반 데이터 관리 유틸리티

// 샘플 스토리 데이터 (기본 데이터 제공)
const sampleStories = [
  {
    id: 'sample-1',
    title: '스튜디오 녹음 작업기',
    category: 'work',
    summary: '스튜디오 녹음 작업 과정에 대한 이야기입니다.',
    content: '스튜디오 녹음은 여러 단계를 거쳐 진행됩니다. 먼저 녹음 준비를 하고, 실제 녹음을 진행한 후, 믹싱과 마스터링 과정을 거칩니다.',
    coverImage: 'https://via.placeholder.com/800x400?text=Studio+Recording',
    createdAt: '2025-03-01T09:00:00.000Z'
  },
  {
    id: 'sample-2',
    title: '음향 엔지니어 인터뷰',
    category: 'interview',
    summary: '베테랑 음향 엔지니어와의 인터뷰 내용입니다.',
    content: '10년 경력의 음향 엔지니어와 함께한 인터뷰입니다. 음향 엔지니어로서의 경험과 조언을 들어봅니다.',
    coverImage: 'https://via.placeholder.com/800x400?text=Sound+Engineer+Interview',
    createdAt: '2025-03-05T14:30:00.000Z'
  },
  {
    id: 'sample-3',
    title: '녹음 장비 선택 가이드',
    category: 'tips',
    summary: '녹음 장비 선택에 대한 팁과 가이드입니다.',
    content: '녹음 장비를 선택할 때 고려해야 할 사항들과 추천 장비 목록입니다.',
    coverImage: 'https://via.placeholder.com/800x400?text=Recording+Equipment+Guide',
    createdAt: '2025-03-10T11:15:00.000Z'
  }
];

// GitHub 설정
const GITHUB_OWNER = 'hwangtab';
const GITHUB_REPO = 'studio';
const DATA_BRANCH = 'data'; // 데이터를 저장할 브랜치
const STORIES_FILE = 'stories.json'; // 데이터 파일명

// GitHub 데이터 URL
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${DATA_BRANCH}`;

// 로컬 스토리지 초기화
const initializeLocalStorage = () => {
  if (!localStorage.getItem('stories')) {
    localStorage.setItem('stories', JSON.stringify(sampleStories));
  }
};

// 로컬 스토리지에서 데이터 가져오기
const getLocalStories = () => {
  const storiesJson = localStorage.getItem('stories');
  if (!storiesJson) {
    return sampleStories;
  }
  try {
    return JSON.parse(storiesJson);
  } catch (error) {
    console.error('로컬 스토리지 데이터 파싱 오류:', error);
    return sampleStories;
  }
};

// 로컬 스토리지에 데이터 저장하기
const saveLocalStories = (stories) => {
  try {
    localStorage.setItem('stories', JSON.stringify(stories));
  } catch (error) {
    console.error('로컬 스토리지 데이터 저장 오류:', error);
  }
};

// GitHub에서 데이터 가져오기
const fetchStoriesFromGitHub = async () => {
  try {
    const response = await fetch(`${GITHUB_RAW_URL}/${STORIES_FILE}`);
    
    if (!response.ok) {
      // 데이터 파일이 없거나 오류 발생 시 로컬 데이터 사용
      console.warn(`GitHub에서 데이터를 가져올 수 없습니다. 상태 코드: ${response.status}`);
      return getLocalStories();
    }
    
    const data = await response.json();
    // 가져온 데이터를 로컬 스토리지에도 저장
    saveLocalStories(data);
    return data;
  } catch (error) {
    console.error('GitHub에서 데이터 가져오기 오류:', error);
    return getLocalStories();
  }
};

// 모든 스토리 가져오기
const getAllStories = async () => {
  try {
    // 먼저 GitHub에서 데이터 가져오기 시도
    const stories = await fetchStoriesFromGitHub();
    return stories;
  } catch (error) {
    console.error('스토리 데이터 가져오기 오류:', error);
    // 오류 발생 시 로컬 데이터 사용
    return getLocalStories();
  }
};

// 카테고리별 스토리 가져오기
const getStoriesByCategory = async (category) => {
  const stories = await getAllStories();
  return category === 'all' ? stories : stories.filter(story => story.category === category);
};

// 특정 스토리 가져오기
const getStoryById = async (id) => {
  const stories = await getAllStories();
  return stories.find(story => story.id === id);
};

// 스토리 추가하기
const addStory = async (story) => {
  try {
    // 로컬 스토리지에서 현재 데이터 가져오기
    const stories = getLocalStories();
    
    // 새 스토리 ID 생성
    const newStory = {
      ...story,
      id: `story-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    // 데이터 업데이트
    const updatedStories = [newStory, ...stories];
    
    // 로컬 스토리지에 저장
    saveLocalStories(updatedStories);
    
    // 사용자에게 GitHub 저장소에 직접 커밋하라는 메시지 표시
    alert('스토리가 로컬에 저장되었습니다. GitHub 저장소에 반영하려면 data 브랜치에 stories.json 파일을 업데이트해주세요.');
    
    return newStory;
  } catch (error) {
    console.error('스토리 추가 오류:', error);
    throw error;
  }
};

// 스토리 수정하기
const updateStory = async (id, updatedStory) => {
  try {
    // 로컬 스토리지에서 현재 데이터 가져오기
    const stories = getLocalStories();
    
    // 스토리 찾기
    const index = stories.findIndex(story => story.id === id);
    if (index === -1) {
      throw new Error('스토리를 찾을 수 없습니다.');
    }
    
    // 업데이트된 스토리
    const newStory = {
      ...stories[index],
      ...updatedStory,
      id, // ID는 유지
      updatedAt: new Date().toISOString() // 업데이트 시간 추가
    };
    
    // 데이터 업데이트
    const updatedStories = [...stories];
    updatedStories[index] = newStory;
    
    // 로컬 스토리지에 저장
    saveLocalStories(updatedStories);
    
    // 사용자에게 GitHub 저장소에 직접 커밋하라는 메시지 표시
    alert('스토리가 로컬에 저장되었습니다. GitHub 저장소에 반영하려면 data 브랜치에 stories.json 파일을 업데이트해주세요.');
    
    return newStory;
  } catch (error) {
    console.error('스토리 수정 오류:', error);
    throw error;
  }
};

// 스토리 삭제하기
const deleteStory = async (id) => {
  try {
    // 로컬 스토리지에서 현재 데이터 가져오기
    const stories = getLocalStories();
    
    // 스토리 찾기
    const index = stories.findIndex(story => story.id === id);
    if (index === -1) {
      throw new Error('스토리를 찾을 수 없습니다.');
    }
    
    // 데이터 업데이트
    const updatedStories = stories.filter(story => story.id !== id);
    
    // 로컬 스토리지에 저장
    saveLocalStories(updatedStories);
    
    // 사용자에게 GitHub 저장소에 직접 커밋하라는 메시지 표시
    alert('스토리가 로컬에서 삭제되었습니다. GitHub 저장소에 반영하려면 data 브랜치에 stories.json 파일을 업데이트해주세요.');
    
    return id;
  } catch (error) {
    console.error('스토리 삭제 오류:', error);
    throw error;
  }
};

// 이미지 URL 처리 (로컬 파일 시스템 대신 Base64 사용)
const handleImageUpload = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
};

// 관리자 인증 (간단한 로컬 인증)
const adminCredentials = {
  username: 'admin',
  password: 'admin123'
};

// 관리자 로그인
const loginAdmin = (username, password) => {
  if (username === adminCredentials.username && password === adminCredentials.password) {
    localStorage.setItem('adminLoggedIn', 'true');
    return true;
  }
  return false;
};

// 관리자 로그인 상태 확인
const isAdminLoggedIn = () => {
  return localStorage.getItem('adminLoggedIn') === 'true';
};

// 관리자 로그아웃
const logoutAdmin = () => {
  localStorage.removeItem('adminLoggedIn');
};

// 초기화
initializeLocalStorage();

export {
  getAllStories,
  getStoriesByCategory,
  getStoryById,
  addStory,
  updateStory,
  deleteStory,
  handleImageUpload,
  loginAdmin,
  isAdminLoggedIn,
  logoutAdmin
};
