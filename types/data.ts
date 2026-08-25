// Portfolio types
import type { Locale } from '../lib/i18n';

export interface PortfolioCategory {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  category: string;
  services: readonly string[];
  featured: boolean;
  artist: string;
  /** 3–5 paragraph production notes (partial locale-map). When present, enables indexing. */
  productionNotes?: Partial<Record<Locale, string>>;
  /** Credit block: engineer, musicians, gear */
  credits?: {
    engineer?: string;
    musicians?: string[];
    gear?: string[];
  };
  /** ISO 8601 release date */
  releaseDate?: string;
  /** Record label */
  label?: string;
  /** Track list with optional duration */
  trackList?: { no: number; title: string; duration?: string }[];
}

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  albumArt: string;
  duration: string;
  featured: boolean;
  description: string;
}

// Site config types
export interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  kakaoUrl: string;
  /** 사람이 클릭하는 지도 링크. 단축 URL이라 모바일 네이버앱 딥링크가 잘 붙는다. */
  naverMapUrl: string;
  /** 기계가 읽는 네이버 플레이스 정본 URL — JSON-LD sameAs 전용. naverMapUrl과 용도가 다르다. */
  naverPlaceUrl: string;
  /** 구글 비즈니스 프로필 CID URL — JSON-LD sameAs 전용. */
  googleBusinessUrl: string;
}

export interface SiteConfig {
  name: string;
  url: string;
  logo: string;
  description: string;
  contact: ContactInfo;
  vatNotice: string;
  /** 통신판매업 신고번호. 신고 완료 전에는 빈 문자열 — 소비처는 값이 있을 때만 표기한다. */
  mailOrderSalesNumber: string;
}

export interface SEODefaults {
  title: string;
  description: string;
  keywords: string;
}

// Shared Component Types
export interface Breadcrumb {
  name: string;
  path: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  content: string;
  datePublished?: string;
  categoryKey?: string;
}
