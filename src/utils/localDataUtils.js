// 로컬 스토리지 기반 데이터 관리 유틸리티

// 샘플 스토리 데이터 (기본 데이터 제공)
const sampleStories = [
  {
    id: 'story-1',
    title: '스튜디오 놀이',
    subtitle: '스튜디오 놀이에 대한 이야기',
    content: '스튜디오 놀이는 창의적인 작업 공간입니다.',
    category: 'project',
    thumbnail: 'https://via.placeholder.com/600x400?text=Studio+Nori',
    createdAt: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'story-2',
    title: '디자인 프로세스',
    subtitle: '우리의 디자인 프로세스',
    content: '우리는 사용자 중심 디자인 방법론을 따릅니다.',
    category: 'design',
    thumbnail: 'https://via.placeholder.com/600x400?text=Design+Process',
    createdAt: '2023-01-02T00:00:00.000Z'
  },
  {
    id: 'story-3',
    title: '팀 소개',
    subtitle: '스튜디오 놀이 팀을 소개합니다',
    content: '우리 팀은 다양한 배경을 가진 창의적인 사람들로 구성되어 있습니다.',
    category: 'about',
    thumbnail: 'https://via.placeholder.com/600x400?text=Our+Team',
    createdAt: '2023-01-03T00:00:00.000Z'
  }
];

// 로컬 스토리지 키
const STORIES_STORAGE_KEY = 'studio_stories';

// 로컬 스토리지 초기화
const initializeLocalStorage = () => {
  if (!localStorage.getItem(STORIES_STORAGE_KEY)) {
    localStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(sampleStories));
  }
};

// 로컬 스토리지에서 데이터 가져오기
const getLocalStories = () => {
  try {
    const storiesJson = localStorage.getItem(STORIES_STORAGE_KEY);
    if (!storiesJson) {
      return sampleStories;
    }
    return JSON.parse(storiesJson);
  } catch (error) {
    console.error('로컬 스토리지 데이터 파싱 오류:', error);
    return sampleStories;
  }
};

// 로컬 스토리지에 데이터 저장하기
const saveLocalStories = (stories) => {
  try {
    // 로컬 스토리지에 저장할 데이터 크기 확인 (5MB 이상의 데이터는 자동으로 크기가 줄어들고 품질이 조정됩니다)
    const storiesJson = JSON.stringify(stories);
    const storiesSize = new Blob([storiesJson]).size;
    const maxSize = 4 * 1024 * 1024; // 4MB
    
    console.log(`로컬 스토리지 데이터 크기 확인: ${Math.round(storiesSize / 1024)}KB`);
    
    if (storiesSize > maxSize) {
      console.warn(`로컬 스토리지 데이터 크기 초과: ${Math.round(storiesSize / 1024 / 1024)}MB / 4MB`);
      
      // 데이터 크기 초과 시 이미지 데이터를 제거하여 데이터 크기를 줄임
      const compressedStories = stories.map(story => {
        // 이미지 데이터가 있는 경우 이미지 URL을 제거
        if (story.thumbnail && story.thumbnail.startsWith('data:image')) {
          // 이미지 URL을 제거하고 데이터 크기를 줄임
          return {
            ...story,
            thumbnail: '[IMAGE_TOO_LARGE]', // 이미지 URL을 제거
            _thumbnailTooLarge: true
          };
        }
        return story;
      });
      
      // 데이터 크기를 줄인 데이터를 로컬 스토리지에 저장
      try {
        localStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(compressedStories));
        console.log('데이터 크기를 줄인 데이터를 로컬 스토리지에 저장 완료');
        
        // 사용자에게 데이터 크기 초과 알림
        alert('로컬 스토리지 데이터 크기 초과로 데이터를 압축하여 저장했습니다. 데이터를 다시 불러와야 합니다.');
        return true;
      } catch (compressError) {
        console.error('데이터 압축 저장 오류:', compressError);
        
        // 데이터 압축 저장 실패 시 기존 데이터를 로컬 스토리지에 저장
        try {
          const existingData = localStorage.getItem(STORIES_STORAGE_KEY);
          const existingStories = existingData ? JSON.parse(existingData) : [];
          
          // 새로운 스토리를 기존 데이터에 추가
          const newStory = stories[stories.length - 1];
          if (newStory) {
            // 이미지 데이터가 있는 경우 이미지 URL을 제거
            if (newStory.thumbnail && newStory.thumbnail.startsWith('data:image')) {
              newStory.thumbnail = '[IMAGE_REMOVED]';
              newStory._thumbnailTooLarge = true;
            }
            if (newStory.imageUrl && newStory.imageUrl.startsWith('data:image')) {
              newStory.imageUrl = '[IMAGE_REMOVED]';
              newStory._imageTooLarge = true;
            }
            
            // 새로운 스토리를 기존 데이터에 추가
            existingStories.push(newStory);
            localStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(existingStories));
            console.log('새로운 스토리를 기존 데이터에 추가하여 로컬 스토리지에 저장 완료');
            alert('로컬 스토리지 데이터 크기 초과로 새로운 스토리를 기존 데이터에 추가하여 저장했습니다. 데이터를 다시 불러와야 합니다.');
            return true;
          }
        } catch (finalError) {
          console.error('최종 저장 오류:', finalError);
          alert('로컬 스토리지 데이터 저장 오류: 데이터 크기 초과로 저장할 수 없습니다. 데이터를 다시 불러와야 합니다.');
        }
        
        return false;
      }
    }
    
    // 데이터 크기가 4MB 이하인 경우 데이터를 로컬 스토리지에 저장
    try {
      localStorage.setItem(STORIES_STORAGE_KEY, storiesJson);
      console.log('로컬 스토리지에 데이터 저장 완료');
      return true;
    } catch (error) {
      console.error('로컬 스토리지 저장 오류:', error);
      
      // QuotaExceededError 오류 발생 시 사용자에게 알림
      if (error.name === 'QuotaExceededError') {
        // 기존 데이터를 로컬 스토리지에 저장
        try {
          const existingData = localStorage.getItem(STORIES_STORAGE_KEY);
          const existingStories = existingData ? JSON.parse(existingData) : [];
          
          // 새로운 스토리를 기존 데이터에 추가
          const newStory = stories[stories.length - 1];
          if (newStory) {
            // 이미지 데이터가 있는 경우 이미지 URL을 제거
            if (newStory.thumbnail && newStory.thumbnail.startsWith('data:image')) {
              newStory.thumbnail = '[IMAGE_REMOVED]';
              newStory._thumbnailTooLarge = true;
            }
            if (newStory.imageUrl && newStory.imageUrl.startsWith('data:image')) {
              newStory.imageUrl = '[IMAGE_REMOVED]';
              newStory._imageTooLarge = true;
            }
            
            // 새로운 스토리를 기존 데이터에 추가
            existingStories.push(newStory);
            localStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(existingStories));
            console.log('새로운 스토리를 기존 데이터에 추가하여 로컬 스토리지에 저장 완료');
            alert('로컬 스토리지 데이터 크기 초과로 새로운 스토리를 기존 데이터에 추가하여 저장했습니다. 데이터를 다시 불러와야 합니다.');
            return true;
          }
        } catch (finalError) {
          console.error('최종 저장 오류:', finalError);
        }
        
        alert('로컬 스토리지 데이터 저장 오류: 데이터 크기 초과로 저장할 수 없습니다. 데이터를 다시 불러와야 합니다.');
      }
      
      return false;
    }
  } catch (error) {
    console.error('로컬 스토리지 저장 오류:', error);
    return false;
  }
};

// 데이터 내보내기 (JSON 파일로 다운로드)
const exportStoriesToJson = () => {
  try {
    const stories = getLocalStories();
    const storiesJson = JSON.stringify(stories, null, 2);
    const blob = new Blob([storiesJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 다운로드 링크 생성 및 클릭
    const a = document.createElement('a');
    a.href = url;
    a.download = `stories_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    // 정리
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    
    return true;
  } catch (error) {
    console.error('데이터 내보내기 오류:', error);
    return false;
  }
};

// 데이터 가져오기 (JSON 파일에서 가져오기)
const importStoriesFromJson = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const stories = JSON.parse(event.target.result);
          saveLocalStories(stories);
          resolve(stories);
        } catch (error) {
          console.error('JSON 파싱 오류:', error);
          reject(new Error('잘못된 JSON 형식입니다.'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('파일 읽기 오류가 발생했습니다.'));
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
      reject(error);
    }
  });
};

// 모든 스토리 가져오기
const getAllStories = () => {
  return getLocalStories();
};

// 카테고리별 스토리 가져오기
const getStoriesByCategory = (category) => {
  const stories = getLocalStories();
  return category === 'all' ? stories : stories.filter(story => story.category === category);
};

// 특정 스토리 가져오기
const getStoryById = (id) => {
  const stories = getLocalStories();
  return stories.find(story => story.id === id);
};

// 스토리 추가하기
const addStory = (story) => {
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
    
    return newStory;
  } catch (error) {
    console.error('스토리 추가 오류:', error);
    throw error;
  }
};

// 스토리 수정하기
const updateStory = (id, updatedStory) => {
  try {
    // 로컬 스토리지에서 현재 데이터 가져오기
    const stories = getLocalStories();
    
    // 스토리 찾기
    const index = stories.findIndex(story => story.id === id);
    if (index === -1) {
      throw new Error('스토리를 찾을 수 없습니다.');
    }
    
    // 업데이트된 스토리 생성
    const newStory = {
      ...stories[index],
      ...updatedStory,
      id, // ID는 변경하지 않음
      updatedAt: new Date().toISOString()
    };
    
    // 데이터 업데이트
    const updatedStories = [...stories];
    updatedStories[index] = newStory;
    
    // 로컬 스토리지에 저장
    saveLocalStories(updatedStories);
    
    return newStory;
  } catch (error) {
    console.error('스토리 수정 오류:', error);
    throw error;
  }
};

// 스토리 삭제하기
const deleteStory = (id) => {
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
    
    return { success: true, id };
  } catch (error) {
    console.error('스토리 삭제 오류:', error);
    throw error;
  }
};

// 이미지 URL 처리 (로컬 파일 시스템 대신 Base64 사용)
const handleImageUpload = (file) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`이미지 업로드 시작: ${Math.round(file.size / 1024)}KB`);
      
      // 이미지 압축 기준을 1MB로 낮춤
      const maxSize = 1 * 1024 * 1024; // 1MB
      const shouldCompress = file.size > maxSize;
      
      // 이미지 압축 함수
      const compressImage = (img, maxWidth = 800) => {
        return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 이미지 크기 조정
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // 이미지 품질을 60%로 낮춤
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          console.log(`이미지 압축 완료: ${Math.round(compressedDataUrl.length / 1024)}KB`);
          resolve(compressedDataUrl);
        });
      };
      
      const reader = new FileReader();
      
      // 이미지 압축
      reader.onload = (event) => {
        // 이미지 로딩 완료
        console.log(`이미지 로딩 완료, 크기: ${Math.round(event.target.result.length / 1024)}KB`);
        
        if (shouldCompress) {
          // 이미지 압축
          const img = new Image();
          img.onload = async () => {
            try {
              const compressedDataUrl = await compressImage(img);
              resolve(compressedDataUrl);
            } catch (error) {
              console.error('이미지 압축 오류:', error);
              reject(error);
            }
          };
          img.onerror = () => {
            reject(new Error('이미지 로딩 오류'));
          };
          img.src = event.target.result;
        } else {
          // 이미지 압축하지 않음
          resolve(event.target.result);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('파일 읽기 오류가 발생했습니다.'));
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      reject(error);
    }
  });
};

// 관리자 인증 (간단한 로컬 인증)
const adminCredentials = {
  username: 'admin',
  password: 'admin123'
};

// 관리자 로그인
const loginAdmin = (username, password) => {
  const isValid = username === adminCredentials.username && password === adminCredentials.password;
  if (isValid) {
    localStorage.setItem('admin_logged_in', 'true');
  }
  return isValid;
};

// 관리자 로그인 상태 확인
const isAdminLoggedIn = () => {
  return localStorage.getItem('admin_logged_in') === 'true';
};

// 관리자 로그아웃
const logoutAdmin = () => {
  localStorage.removeItem('admin_logged_in');
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
  logoutAdmin,
  exportStoriesToJson,
  importStoriesFromJson
};
