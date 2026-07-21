// 첫 로드(SSR/hydration) 이후 클라이언트 사이드 내비게이션이 발생했는지 추적.
// ImageHero가 "첫 로드에는 페이드 없이 즉시 표시(LCP 보호), 전환으로 mount될 때만
// 페이드인" 을 구분하는 데 사용한다. 서버에서는 항상 false → SSR HTML과 hydration
// 첫 렌더의 클래스가 일치해 mismatch 없음.
let navigated = false;

export const markNavigated = () => {
  navigated = true;
};

export const hasNavigatedSinceLoad = () => navigated;

export const resetNavigatedForTests = () => {
  navigated = false;
};
