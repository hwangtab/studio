/**
 * 저장소 객체 키 검증. **의존성이 없는 파일로 떼어 둔다** — 서명 발급기(`r2.ts`)에 두면
 * 이 함수를 쓰는 콘텐츠 파서(`projects.ts`)를 거쳐 AWS 서명 라이브러리가 모든 모듈
 * 그래프로 끌려 들어간다.
 */
export const isSafeObjectKey = (key: string): boolean =>
  key.length > 0
  && key.length <= 512
  && !key.startsWith('/')
  && !key.includes('..')
  && !key.includes('://')
  && /^[A-Za-z0-9!\-_.*'()/]+$/.test(key);
