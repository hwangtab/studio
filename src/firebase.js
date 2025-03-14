// Firebase 설정 파일
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';

// Firebase 구성 정보
const firebaseConfig = {
  apiKey: "AIzaSyAeQQvXfhGTJkJeFsXDT6vQx_W1rSkSgU0",
  authDomain: "studio-nol.firebaseapp.com",
  projectId: "studio-nol",
  storageBucket: "studio-nol.firebasestorage.app",
  messagingSenderId: "532597796083",
  appId: "1:532597796083:web:6bba86e58d75154a345b86",
  measurementId: "G-WE2T2BNMC2"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
let analytics = null;

// 로컬 개발 환경에서 에뮬레이터 사용 설정
if (window.location.hostname === 'localhost') {
  // 에뮬레이터 연결 (로컬 개발 시)
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('Firebase 에뮬레이터 연결 성공');
  } catch (error) {
    console.error('Firebase 에뮬레이터 연결 실패:', error);
  }
}

// 분석 초기화 (브라우저 환경에서만)
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Firebase Analytics 초기화 실패:', error);
  }
}

// 인증 상태 변경 감지 (디버깅용)
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('Firebase 인증 상태: 로그인됨', user.email);
  } else {
    console.log('Firebase 인증 상태: 로그아웃됨');
  }
});

// 테스트 로그인 함수 (개발 환경에서만 사용)
export const testLogin = async () => {
  try {
    // 테스트 계정으로 로그인 (실제 프로덕션에서는 제거해야 함)
    await signInWithEmailAndPassword(auth, 'test@example.com', 'password123');
    return true;
  } catch (error) {
    console.error('테스트 로그인 실패:', error);
    return false;
  }
};

export { auth, db, storage, analytics };
