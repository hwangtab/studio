// 로컬 스토리지 기반 데이터 관리 유틸리티

// 샘플 스토리 데이터 (빈 배열로 변경)
const sampleStories = [];

// GitHub 설정
const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN || '';
const GITHUB_OWNER = 'hwangtab';
const GITHUB_REPO = 'studio';
const GITHUB_PATH = 'data/stories.json';

// GitHub API 설정
const GITHUB_CONFIG = {
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
  branch: 'main',
  dataPath: GITHUB_PATH,
  token: GITHUB_TOKEN // GitHub 토큰 (비밀번호 대신 사용)
};

// GitHub API에서 데이터 가져오기
const fetchStoriesFromGitHub = async () => {
  try {
    if (!GITHUB_CONFIG.token) {
      console.warn('GitHub 토큰이 설정되지 않았습니다. 로컬 데이터를 사용합니다.');
      return getLocalStories();
    }

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataPath}?ref=${GITHUB_CONFIG.branch}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_CONFIG.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      // GitHub API 오류
      if (response.status === 404) {
        // 데이터가 없을 경우 빈 배열을 반환합니다.
        console.log('데이터가 없습니다.');
        return [];
      }
      throw new Error(`GitHub API 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = atob(data.content); // Base64 디코딩
    return JSON.parse(content);
  } catch (error) {
    console.error('GitHub API에서 데이터 가져오기 오류:', error);
    // 오류 발생 시 로컬 데이터를 사용합니다.
    return getLocalStories();
  }
};

// GitHub API에 데이터 저장하기
const saveStoriesToGitHub = async (stories) => {
  try {
    if (!GITHUB_CONFIG.token) {
      console.warn('GitHub 토큰이 설정되지 않았습니다. 로컬 데이터를 사용합니다.');
      saveLocalStories(stories);
      return;
    }

    // 데이터 파일 정보 가져오기
    let sha = null;
    try {
      const fileInfoResponse = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataPath}?ref=${GITHUB_CONFIG.branch}`, {
        headers: {
          'Authorization': `token ${GITHUB_CONFIG.token}`,
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
    const response = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_CONFIG.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: '데이터 업데이트',
        content: btoa(JSON.stringify(stories, null, 2)), // Base64 인코딩
        branch: GITHUB_CONFIG.branch,
        sha: sha
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API 데이터 저장 오류: ${response.status} ${response.statusText}`);
    }

    // 로컬 데이터 저장하기
    saveLocalStories(stories);
    
    return await response.json();
  } catch (error) {
    console.error('GitHub API 데이터 저장 오류:', error);
    // 오류 발생 시 로컬 데이터를 저장합니다.
    saveLocalStories(stories);
    throw error;
  }
};

// 로컬 스토리지 초기화
const initializeLocalStorage = () => {
  if (!localStorage.getItem('stories')) {
    localStorage.setItem('stories', JSON.stringify([]));
    console.log('로컬 스토리지 초기화 완료');
  }
};

// 로컬 스토리지에서 데이터 가져오기
const getLocalStories = () => {
  initializeLocalStorage();
  try {
    const stories = JSON.parse(localStorage.getItem('stories') || '[]');
    return stories;
  } catch (error) {
    console.error('로컬 스토리지 데이터 가져오기 오류:', error);
    return [];
  }
};

// 로컬 스토리지에 데이터 저장하기
const saveLocalStories = (stories) => {
  try {
    localStorage.setItem('stories', JSON.stringify(stories));
    return true;
  } catch (error) {
    console.error('로컬 스토리지 데이터 저장 오류:', error);
    return false;
  }
};

// 모든 스토리 가져오기
export const getAllStories = async () => {
  try {
    // GitHub API에서 데이터 가져오기
    const stories = await fetchStoriesFromGitHub();
    return stories;
  } catch (error) {
    console.error('데이터 가져오기 오류:', error);
    // 오류 발생 시 로컬 데이터를 사용합니다.
    return getLocalStories();
  }
};

// 카테고리별 스토리 가져오기
export const getStoriesByCategory = async (category) => {
  const stories = await getAllStories();
  return stories.filter(story => story.category === category);
};

// 특정 스토리 가져오기
export const getStoryById = async (id) => {
  const stories = await getAllStories();
  return stories.find(story => story.id === id) || null;
};

// 스토리 추가하기
export const addStory = async (story) => {
  try {
    const stories = await getAllStories();
    const newStory = {
      ...story,
      id: Date.now().toString(), // 고유 ID 생성
      createdAt: new Date().toISOString()
    };
    
    stories.push(newStory);
    
    // GitHub API에 데이터 저장하기
    await saveStoriesToGitHub(stories);
    
    return newStory;
  } catch (error) {
    console.error('스토리 추가 오류:', error);
    
    // 오류 발생 시 로컬 데이터를 저장합니다.
    const stories = getLocalStories();
    const newStory = {
      ...story,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    stories.push(newStory);
    saveLocalStories(stories);
    
    return newStory;
  }
};

// 스토리 수정하기
export const updateStory = async (id, updatedStory) => {
  try {
    const stories = await getAllStories();
    const index = stories.findIndex(story => story.id === id);
    
    if (index !== -1) {
      stories[index] = { ...stories[index], ...updatedStory };
      
      // GitHub API에 데이터 저장하기
      await saveStoriesToGitHub(stories);
      
      return stories[index];
    }
    return null;
  } catch (error) {
    console.error('스토리 수정 오류:', error);
    
    // 오류 발생 시 로컬 데이터를 저장합니다.
    const stories = getLocalStories();
    const index = stories.findIndex(story => story.id === id);
    
    if (index !== -1) {
      stories[index] = { ...stories[index], ...updatedStory };
      saveLocalStories(stories);
      return stories[index];
    }
    
    return null;
  }
};

// 스토리 삭제하기
export const deleteStory = async (id) => {
  try {
    const stories = await getAllStories();
    const filteredStories = stories.filter(story => story.id !== id);
    
    // GitHub API에 데이터 저장하기
    await saveStoriesToGitHub(filteredStories);
    
    return true;
  } catch (error) {
    console.error('스토리 삭제 오류:', error);
    
    // 오류 발생 시 로컬 데이터를 저장합니다.
    const stories = getLocalStories();
    const filteredStories = stories.filter(story => story.id !== id);
    saveLocalStories(filteredStories);
    
    return true;
  }
};

// 이미지 URL 처리 (로컬 파일 시스템 대신 Base64 사용)
export const handleImageUpload = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target.result); // Base64 인코딩된 이미지 데이터
    };
    reader.onerror = (error) => {
      console.error('이미지 업로드 오류:', error);
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

export const loginAdmin = (username, password) => {
  if (username === adminCredentials.username && password === adminCredentials.password) {
    localStorage.setItem('isLoggedIn', 'true');
    return true;
  }
  return false;
};

export const isAdminLoggedIn = () => {
  return localStorage.getItem('isLoggedIn') === 'true';
};

export const logoutAdmin = () => {
  localStorage.removeItem('isLoggedIn');
};
