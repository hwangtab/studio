// Next.js 빌드 산출물(_buildManifest.js, __NEXT_DATA__)은 `/[locale]/contact` 같은
// 동적 라우트 패턴을 URL처럼 보이는 문자열로 노출한다. JS·JSON에서 URL을 긁는
// 스크래퍼가 이걸 실제 경로로 오인해 요청하며, 이는 Next.js 앱의 구조적 특성이라
// 소스에서 제거할 수 없다.
//
// 정상 경로(로케일·스토리 슬러그·지역 슬러그)에는 대괄호가 절대 들어가지 않으므로,
// 대괄호가 보이면 그건 라우트 패턴이 URL로 새어나온 것이다.
const BRACKET_PATH_RE = /\[|\]|%5b|%5d/i;

/** 동적 라우트 패턴 문자열이 URL로 요청된 경로인지 판정한다. */
export const isRoutePatternPath = (pathname: string): boolean => BRACKET_PATH_RE.test(pathname);
