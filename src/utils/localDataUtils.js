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
// 주의: 토큰을 직접 코드에 포함하지 않고 환경변수를 사용합니다.
const getGitHubToken = () => {
  const token = localStorage.getItem('github_token') || process.env.REACT_APP_GITHUB_TOKEN || '';
  console.log('GitHub 토큰 상태:', token ? '토큰 있음' : '토큰 없음');
  return token;
};
const GITHUB_OWNER = 'hwangtab';
const GITHUB_REPO = 'studio';
const GITHUB_BRANCH = 'data';
const GITHUB_PATH = 'stories.json';

// GitHub API 설정
const getGitHubConfig = () => {
  const token = getGitHubToken();
  return {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    dataPath: GITHUB_PATH,
    token: token
  };
};

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

// GitHub API를 통해 데이터 가져오기
const fetchStoriesFromGitHub = async () => {
  try {
    const config = getGitHubConfig();
    const token = config.token;
    
    // 토큰이 없으면 로컬 데이터 사용
    if (!token) {
      console.warn('GitHub 토큰이 없습니다. 로컬 데이터를 사용합니다.');
      return getLocalStories();
    }
    
    console.log('GitHub에서 데이터 가져오기 시도 중...');
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dataPath}?ref=${config.branch}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // GitHub API 오류
      if (response.status === 404) {
        // 데이터 파일이 없는 경우 기본 데이터 사용
        console.log('데이터 파일이 없습니다. 기본 데이터를 사용합니다.');
        await saveStoriesToGitHub(sampleStories);
        return sampleStories;
      }
      console.warn(`GitHub API 오류: ${response.status} ${response.statusText}`);
      return getLocalStories();
    }

    const data = await response.json();
    const content = atob(data.content); // Base64 디코딩
    
    // 데이터 파싱
    let stories;
    try {
      stories = JSON.parse(content);
    } catch (e) {
      // 데이터 파싱 오류
      const decodedContent = decodeURIComponent(escape(content));
      stories = JSON.parse(decodedContent);
    }
    
    // 데이터 저장
    saveLocalStories(stories);
    return stories;
  } catch (error) {
    console.error('GitHub API 오류:', error);
    // 오류 발생 시 로컬 데이터 사용
    return getLocalStories();
  }
};

// GitHub API를 통해 데이터 저장하기
const saveStoriesToGitHub = async (stories) => {
  try {
    const config = getGitHubConfig();
    const token = config.token;
    
    // 토큰이 없으면 로컬 데이터만 저장
    if (!token) {
      console.warn('GitHub 토큰이 없습니다. 로컬에만 저장합니다.');
      saveLocalStories(stories);
      throw new Error('GitHub 토큰이 없습니다. 로컬에만 저장되었습니다.');
    }
    
    console.log('GitHub에 데이터 저장 시도 중...');
    
    // 현재 파일 정보 가져오기 (SHA 값 필요)
    let sha = null;
    try {
      const getResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dataPath}?ref=${config.branch}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
        console.log('기존 파일 SHA:', sha);
      }
    } catch (error) {
      console.log('파일이 존재하지 않습니다. 새로 생성합니다.');
    }
    
    // 데이터 저장
    const content = JSON.stringify(stories, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));
    
    const requestBody = {
      message: '스토리 데이터 업데이트',
      content: encodedContent,
      branch: config.branch
    };
    
    // 기존 파일이 있으면 SHA 추가
    if (sha) {
      requestBody.sha = sha;
    }
    
    const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dataPath}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error(`GitHub API 오류: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('오류 응답:', errorText);
      throw new Error(`GitHub API 오류: ${response.status}`);
    }

    // 로컬 스토리지에 저장
    saveLocalStories(stories);
    
    console.log('GitHub에 데이터 저장 성공!');
    return await response.json();
  } catch (error) {
    console.error('GitHub API 오류:', error);
    // 오류 발생 시 로컬 데이터 사용
    saveLocalStories(stories);
    throw error;
  }
};

// 모든 스토리 가져오기
const getAllStories = async () => {
  try {
    // 먼저 GitHub API를 통해 데이터 가져오기 시도
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
    
    // GitHub API를 통해 데이터 저장
    await saveStoriesToGitHub(updatedStories);
    
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
    
    // GitHub API를 통해 데이터 저장
    await saveStoriesToGitHub(updatedStories);
    
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
    
    // GitHub API를 통해 데이터 저장
    await saveStoriesToGitHub(updatedStories);
    
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
