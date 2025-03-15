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
  return process.env.REACT_APP_GITHUB_TOKEN || localStorage.getItem('github_token') || '';
};
const GITHUB_OWNER = 'hwangtab';
const GITHUB_REPO = 'studio';
const GITHUB_BRANCH = 'data';
const GITHUB_PATH = 'stories.json';

// GitHub API 설정
const getGitHubConfig = () => {
  return {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    dataPath: GITHUB_PATH,
    token: getGitHubToken()
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
    const url = `https://api.github.com/repos/${getGitHubConfig().owner}/${getGitHubConfig().repo}/contents/${getGitHubConfig().dataPath}?ref=${getGitHubConfig().branch}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${getGitHubConfig().token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      // GitHub API uc624ub958
      if (response.status === 404) {
        // ub370uc774ud130uac00 uc5c6uc744 uacbduc6b0 uc0d8ud50c ub370uc774ud130ub97c uc800uc7a5ud558uace0 ubc18ud658
        console.log('ub370uc774ud130 ud30cuc77cuc774 uc5c6uc2b5ub2c8ub2e4. uc0c8ub85c uc0dduc131ud569ub2c8ub2e4.');
        await saveStoriesToGitHub(sampleStories);
        return sampleStories;
      }
      console.warn(`GitHubuc5d0uc11c ub370uc774ud130ub97c uac00uc838uc62c uc218 uc5c6uc2b5ub2c8ub2e4. uc0c1ud0dc ucf54ub4dc: ${response.status}`);
      return getLocalStories();
    }

    const data = await response.json();
    const content = atob(data.content); // Base64 uc514ucf54ub529
    
    // uac00ub2a5ud55c uc778ucf54ub529 ubb38uc81c ud574uacb0
    let stories;
    try {
      stories = JSON.parse(content);
    } catch (e) {
      // uc778ucf54ub529 ubb38uc81c ubc1cuc0dd uc2dc ub514ucf54ub529 ubc29ubc95 ubcc0uacbd
      const decodedContent = decodeURIComponent(escape(content));
      stories = JSON.parse(decodedContent);
    }
    
    // uac00uc838uc628 ub370uc774ud130ub97c ub85cuceec uc2a4ud1a0ub9acuc9c0uc5d0ub3c4 uc800uc7a5
    saveLocalStories(stories);
    return stories;
  } catch (error) {
    console.error('GitHub APIuc5d0uc11c ub370uc774ud130 uac00uc838uc624uae30 uc624ub958:', error);
    // uc624ub958 ubc1cuc0dd uc2dc ub85cuceec ub370uc774ud130ub97c uc0acuc6a9ud569ub2c8ub2e4.
    return getLocalStories();
  }
};

// GitHub API를 통해 데이터 저장하기
const saveStoriesToGitHub = async (stories) => {
  try {
    // 데이터 파일이 있는지 확인
    let sha = null;
    try {
      const fileInfoResponse = await fetch(`https://api.github.com/repos/${getGitHubConfig().owner}/${getGitHubConfig().repo}/contents/${getGitHubConfig().dataPath}?ref=${getGitHubConfig().branch}`, {
        headers: {
          'Authorization': `token ${getGitHubConfig().token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (fileInfoResponse.ok) {
        const fileInfo = await fileInfoResponse.json();
        sha = fileInfo.sha;
      }
    } catch (error) {
      console.log('데이터 파일 정보 가져오기 오류:', error);
    }

    // 데이터 파일 업데이트
    // Base64 인코딩 - Latin1 인코딩 사용
    const storiesJson = JSON.stringify(stories, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(storiesJson)));
    
    const response = await fetch(`https://api.github.com/repos/${getGitHubConfig().owner}/${getGitHubConfig().repo}/contents/${getGitHubConfig().dataPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${getGitHubConfig().token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: '데이터 파일 업데이트',
        content: base64Content,
        branch: getGitHubConfig().branch,
        sha: sha
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API를 통해 데이터 저장 오류: ${response.status} ${response.statusText}`);
    }

    // 로컬 스토리지에 저장
    saveLocalStories(stories);
    
    return await response.json();
  } catch (error) {
    console.error('GitHub API를 통해 데이터 저장 오류:', error);
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
