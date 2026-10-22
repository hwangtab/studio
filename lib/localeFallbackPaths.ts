import { createContext, useContext } from 'react';

import type { Locale } from './i18n';

/**
 * 이 페이지가 어떤 로케일로는 열리지 않을 때, 언어 전환기가 대신 보낼 주소.
 *
 * 페이지가 getStaticProps에서 `localeFallbackPaths`를 돌려주면 _app이 이 컨텍스트로 내려 주고,
 * LanguageSwitcher가 그 로케일 링크를 이 주소로 바꾼다. 지금 쓰는 곳은 ko 원본이 없는 native-only
 * 스토리(slug.en.md만 있는 글) — /ko/stories/<slug>는 404라 한국어를 고르면 목록으로 보낸다(2026-10-22 리뷰).
 * 다른 로케일은 영어 원문을 대신 보여 주는 폴백이 있어 그대로 둔다.
 */
export type LocaleFallbackPaths = Partial<Record<Locale, string>>;

export const LocaleFallbackPathsContext = createContext<LocaleFallbackPaths>({});

export const useLocaleFallbackPaths = (): LocaleFallbackPaths => useContext(LocaleFallbackPathsContext);
