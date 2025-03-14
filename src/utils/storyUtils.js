import { collection, addDoc, getDocs, getDoc, doc, query, where, orderBy, deleteDoc, updateDoc, limit, startAfter, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';

// 스토리 컬렉션 참조
let storiesRef;
try {
  storiesRef = collection(db, 'stories');
  console.log('Firestore 스토리 컬렉션 참조 성공');
} catch (error) {
  console.error('Firestore 스토리 컬렉션 참조 실패:', error);
  // 임시 대체 참조 객체 생성
  storiesRef = { id: 'stories', path: 'stories' };
}

// 캐시 객체
const cache = {
  allStories: null,
  categorizedStories: {},
  storyDetails: {},
  lastFetch: {
    allStories: null,
    categorizedStories: {},
    storyDetails: {}
  }
};

// 캐시 유효성 확인 (5분)
const isCacheValid = (type, key = 'default') => {
  const lastFetch = key === 'default' ? cache.lastFetch[type] : cache.lastFetch[type][key];
  if (!lastFetch) return false;
  
  const cacheLifetime = 5 * 60 * 1000; // 5분
  return Date.now() - lastFetch < cacheLifetime;
};

/**
 * 모든 스토리 가져오기
 * @param {string} sortField - 정렬 기준 필드
 * @param {string} sortDirection - 정렬 방향 ('asc' 또는 'desc')
 * @param {number} pageSize - 페이지당 항목 수
 * @param {boolean} useCache - 캐시 사용 여부
 * @returns {Promise<Array>} - 스토리 배열
 */
export const getAllStories = async (sortField = 'date', sortDirection = 'desc', pageSize = 10, useCache = true) => {
  try {
    // 캐시 확인
    if (useCache && cache.allStories && isCacheValid('allStories')) {
      console.log('캐시된 스토리 데이터 사용');
      return cache.allStories;
    }
    
    const q = query(storiesRef, orderBy(sortField, sortDirection), limit(pageSize));
    const querySnapshot = await getDocs(q);
    
    const stories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 캐시 업데이트
    cache.allStories = stories;
    cache.lastFetch.allStories = Date.now();
    
    return stories;
  } catch (error) {
    console.error('스토리 가져오기 오류:', error);
    throw error;
  }
};

/**
 * 카테고리별 스토리 가져오기
 * @param {string} category - 스토리 카테고리
 * @param {number} pageSize - 페이지당 항목 수
 * @param {boolean} useCache - 캐시 사용 여부
 * @returns {Promise<Array>} - 스토리 배열
 */
export const getStoriesByCategory = async (category, pageSize = 10, useCache = true) => {
  try {
    // 캐시 확인
    if (useCache && cache.categorizedStories[category] && isCacheValid('categorizedStories', category)) {
      console.log(`캐시된 ${category} 카테고리 데이터 사용`);
      return cache.categorizedStories[category];
    }
    
    const q = query(
      storiesRef, 
      where('category', '==', category),
      orderBy('date', 'desc'),
      limit(pageSize)
    );
    const querySnapshot = await getDocs(q);
    
    const stories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 캐시 업데이트
    cache.categorizedStories[category] = stories;
    if (!cache.lastFetch.categorizedStories) cache.lastFetch.categorizedStories = {};
    cache.lastFetch.categorizedStories[category] = Date.now();
    
    return stories;
  } catch (error) {
    console.error('카테고리별 스토리 가져오기 오류:', error);
    throw error;
  }
};

/**
 * 스토리 상세 정보 가져오기
 * @param {string} id - 스토리 ID
 * @param {boolean} useCache - 캐시 사용 여부
 * @returns {Promise<Object>} - 스토리 객체
 */
export const getStoryById = async (id, useCache = true) => {
  try {
    // 캐시 확인
    if (useCache && cache.storyDetails[id] && isCacheValid('storyDetails', id)) {
      console.log(`캐시된 스토리 상세 데이터 사용 (ID: ${id})`);
      return cache.storyDetails[id];
    }
    
    const storyDoc = await getDoc(doc(db, 'stories', id));
    
    if (storyDoc.exists()) {
      const storyData = {
        id: storyDoc.id,
        ...storyDoc.data()
      };
      
      // 캐시 업데이트
      cache.storyDetails[id] = storyData;
      if (!cache.lastFetch.storyDetails) cache.lastFetch.storyDetails = {};
      cache.lastFetch.storyDetails[id] = Date.now();
      
      return storyData;
    } else {
      throw new Error('스토리를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('스토리 상세 가져오기 오류:', error);
    throw error;
  }
};

/**
 * 페이지네이션을 위한 추가 스토리 로드
 * @param {string} sortField - 정렬 기준 필드
 * @param {string} sortDirection - 정렬 방향 ('asc' 또는 'desc')
 * @param {number} pageSize - 페이지당 항목 수
 * @param {Object} lastVisible - 마지막으로 표시된 문서
 * @returns {Promise<{stories: Array, lastVisible: Object}>} - 스토리 배열과 마지막 문서
 */
export const getMoreStories = async (sortField = 'date', sortDirection = 'desc', pageSize = 10, lastVisible = null) => {
  try {
    let q;
    
    if (lastVisible) {
      q = query(
        storiesRef,
        orderBy(sortField, sortDirection),
        limit(pageSize),
        startAfter(lastVisible)
      );
    } else {
      q = query(
        storiesRef,
        orderBy(sortField, sortDirection),
        limit(pageSize)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
    
    const stories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return {
      stories,
      lastVisible: lastVisibleDoc
    };
  } catch (error) {
    console.error('추가 스토리 가져오기 오류:', error);
    throw error;
  }
};

/**
 * 이미지 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @param {string} path - 저장 경로
 * @returns {Promise<string>} - 이미지 URL
 */
export const uploadImage = async (file, path = 'stories') => {
  try {
    // 이미지 크기 최적화를 위한 경로 설정
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    throw error;
  }
};

/**
 * 스토리 데이터 정리
 * @param {Object} storyData - 스토리 데이터
 * @returns {Object} - 정리된 스토리 데이터
 */
const cleanStoryData = (storyData) => {
  console.log('스토리 데이터 정리 시작:', JSON.stringify(storyData).substring(0, 200) + '...');
  
  // 기본 데이터 설정
  const cleanedData = {
    title: storyData.title || '',
    category: storyData.category || '작업기',  // 기본값 설정: '작업기', '인터뷰', '팁과 정보' 중 하나
    summary: storyData.summary || '',
    content: storyData.content || '',
    date: storyData.date || new Date().toISOString().split('T')[0],
    author: storyData.author || '',
    thumbnail: storyData.thumbnail || '',
    images: Array.isArray(storyData.images) ? storyData.images : []
  };
  
  // 카테고리 유효성 검사 (허용된 카테고리만 사용)
  const validCategories = ['작업기', 'work', '인터뷰', 'interview', '팁과 정보', 'tips'];
  if (!validCategories.includes(cleanedData.category)) {
    console.warn(`유효하지 않은 카테고리: ${cleanedData.category}, 기본값 '작업기'로 설정합니다.`);
    cleanedData.category = '작업기';
  }
  
  // 불필요한 필드 제거 (id, createdAt, updatedAt 등)
  const fieldsToRemove = ['id', 'createdAt', 'updatedAt', 'docId', '__proto__'];
  fieldsToRemove.forEach(field => {
    if (cleanedData[field]) {
      delete cleanedData[field];
    }
  });
  
  // 내용 필드의 데이터 타입이 문자열인지 확인
  if (typeof cleanedData.content !== 'string') {
    console.warn('내용 필드의 데이터 타입이 문자열이 아닙니다:', typeof cleanedData.content);
    try {
      if (cleanedData.content === null || cleanedData.content === undefined) {
        cleanedData.content = '';
      } else if (typeof cleanedData.content === 'object') {
        cleanedData.content = JSON.stringify(cleanedData.content);
      } else {
        cleanedData.content = String(cleanedData.content);
      }
    } catch (error) {
      console.error('내용 필드 변환 오류:', error);
      cleanedData.content = '';
    }
  }
  
  // 썸네일 URL 유효성 검사
  if (cleanedData.thumbnail && typeof cleanedData.thumbnail === 'string') {
    // URL 유효성 검사
    if (!cleanedData.thumbnail.startsWith('http')) {
      cleanedData.thumbnail = '';
    }
  } else {
    cleanedData.thumbnail = '';
  }
  
  // 이미지 URL 유효성 검사
  if (Array.isArray(cleanedData.images)) {
    cleanedData.images = cleanedData.images.filter(img => {
      return typeof img === 'string' && img.startsWith('http');
    });
  } else {
    cleanedData.images = [];
  }
  
  console.log('정리된 스토리 데이터:', JSON.stringify(cleanedData).substring(0, 200) + '...');
  return cleanedData;
};

/**
 * 새 스토리 추가
 * @param {Object} storyData - 스토리 데이터
 * @returns {Promise<string>} - 생성된 스토리 ID
 */
export const addStory = async (storyData) => {
  try {
    console.log('스토리 데이터 저장 시작:', JSON.stringify(storyData).substring(0, 200) + '...');
    
    // 데이터 유효성 검사 추가
    if (!storyData.title) {
      throw new Error('제목은 필수입니다');
    }
    
    // 현재 인증된 사용자 확인
    if (!auth.currentUser) {
      throw new Error('인증된 사용자만 스토리를 추가할 수 있습니다');
    }
    
    // 스토리 데이터 정리
    const cleanedData = cleanStoryData(storyData);
    
    // 데이터 크기 확인 (Firestore 제한: 1MB)
    const dataSize = JSON.stringify(cleanedData).length;
    if (dataSize > 900000) { // 안전 마진 설정
      console.error('스토리 데이터가 너무 큽니다:', dataSize, 'bytes');
      throw new Error('스토리 데이터가 너무 큽니다. 이미지나 내용을 줄여주세요.');
    }
    
    console.log('정리된 스토리 데이터 크기:', dataSize, 'bytes');
    
    // 서버 타임스탬프 사용
    const docData = {
      ...cleanedData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: auth.currentUser.email || '',
      uid: auth.currentUser.uid || ''
    };
    
    // Firestore에 추가
    console.log('Firestore에 스토리 추가 시도...');
    const docRef = await addDoc(storiesRef, docData);
    
    console.log('스토리 저장 완료, ID:', docRef.id);
    
    // 캐시 무효화
    cache.allStories = null;
    cache.lastFetch.allStories = null;
    if (cleanedData.category) {
      cache.categorizedStories[cleanedData.category] = null;
      if (cache.lastFetch.categorizedStories) {
        cache.lastFetch.categorizedStories[cleanedData.category] = null;
      }
    }
    
    return docRef.id;
  } catch (error) {
    console.error('스토리 추가 오류:', error.message, error.stack);
    // Firebase 오류 코드 확인
    if (error.code) {
      console.error('Firebase 오류 코드:', error.code);
      if (error.code === 'permission-denied') {
        throw new Error('권한이 없습니다. 관리자에게 문의하세요.');
      }
    }
    throw error;
  }
};

/**
 * 스토리 업데이트
 * @param {string} id - 스토리 ID
 * @param {Object} storyData - 업데이트할 스토리 데이터
 * @returns {Promise<void>}
 */
export const updateStory = async (id, storyData) => {
  try {
    console.log('스토리 업데이트 시작:', id, JSON.stringify(storyData).substring(0, 200) + '...');
    
    // ID 유효성 검사 추가
    if (!id) {
      throw new Error('스토리 ID가 없습니다');
    }
    
    if (!storyData.title) {
      throw new Error('제목은 필수입니다');
    }
    
    // 현재 인증된 사용자 확인
    if (!auth.currentUser) {
      throw new Error('인증된 사용자만 스토리를 수정할 수 있습니다');
    }
    
    // 스토리 데이터 정리
    const cleanedData = cleanStoryData(storyData);
    
    console.log('정리된 스토리 데이터:', JSON.stringify(cleanedData).substring(0, 200) + '...');
    
    // Firestore 문서 참조
    const storyRef = doc(db, 'stories', id);
    
    // 문서 존재 여부 확인
    const storySnap = await getDoc(storyRef);
    if (!storySnap.exists()) {
      throw new Error('스토리를 찾을 수 없습니다');
    }
    
    // 서버 타임스탬프 사용
    await updateDoc(storyRef, {
      ...cleanedData,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email
    });
    
    console.log('스토리 업데이트 완료:', id);
    
    // 캐시 무효화
    cache.allStories = null;
    cache.lastFetch.allStories = null;
    cache.storyDetails[id] = null;
    cache.lastFetch.storyDetails[id] = null;
    if (cleanedData.category) {
      cache.categorizedStories[cleanedData.category] = null;
      if (cache.lastFetch.categorizedStories) {
        cache.lastFetch.categorizedStories[cleanedData.category] = null;
      }
    }
  } catch (error) {
    console.error('스토리 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 스토리 삭제
 * @param {string} id - 삭제할 스토리 ID
 * @returns {Promise<void>}
 */
export const deleteStory = async (id) => {
  try {
    // 삭제 전에 스토리 데이터 가져오기 (카테고리 정보를 위해)
    const storyData = await getStoryById(id, false);
    
    await deleteDoc(doc(db, 'stories', id));
    
    // 캐시 무효화
    cache.allStories = null;
    cache.lastFetch.allStories = null;
    cache.storyDetails[id] = null;
    cache.lastFetch.storyDetails[id] = null;
    if (storyData && storyData.category) {
      cache.categorizedStories[storyData.category] = null;
      if (cache.lastFetch.categorizedStories) {
        cache.lastFetch.categorizedStories[storyData.category] = null;
      }
    }
  } catch (error) {
    console.error('스토리 삭제 오류:', error);
    throw error;
  }
};
