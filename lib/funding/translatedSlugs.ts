/**
 * 번역본이 있는 펀딩 프로젝트 — 클라이언트에서도 읽는 목록(언어 전환기·ko 전용 경로 판정).
 *
 * 번역 파일(`content/funding/<locale>/<slug>.md`)은 서버에서만 읽을 수 있어서(node:fs) 목록을 따로 둔다.
 * 파일과 이 목록이 갈리면 `lib/funding/translations.test.ts`가 잡는다 — 파일만 있으면 페이지가 404,
 * 목록만 있으면 언어 전환기가 없는 페이지로 보낸다.
 *
 * 번역본은 **상세 페이지 한 장**이다. 후원(결제)·약관·확인 메일은 한국어 그대로이고, 영문 화면은 한국어
 * 결제 화면으로 보낸다 — 리워드 금액에 국내 배송비만 들어 있고 약관 판본이 한국어 문서에 묶여 있다.
 */
export type FundingTranslationLocale = 'en';

export const FUNDING_TRANSLATED_SLUGS: Readonly<Record<string, readonly FundingTranslationLocale[]>> = {
  'sabbaha-slung': ['en'],
};

export const hasFundingTranslation = (slug: string, locale: string): locale is FundingTranslationLocale =>
  (FUNDING_TRANSLATED_SLUGS[slug] as readonly string[] | undefined)?.includes(locale) ?? false;

/** 펀딩 상세 화면을 그리는 언어. 정본은 ko, 번역본이 있는 프로젝트만 en으로도 그린다. */
export type FundingLang = 'ko' | FundingTranslationLocale;
