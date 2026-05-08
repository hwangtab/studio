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

// Service types
export interface ServiceItem {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
}

export interface ProcessStep extends ServiceItem { }

export interface Advantage extends ServiceItem { }

export interface CoreService extends ServiceItem { }

// Pricing types
export interface PricingPlan {
  id: string;
  title: string;
  priceDisplay: string;
  priceValue: number;
  unit?: string;
  description: string;
  features?: readonly string[];
  recommended?: boolean;
  note?: string;
}

// Home types
export interface HomeService {
  title: string;
  description: string;
  link: string;
  icon: React.ComponentType<any>;
}

export interface StudioImage {
  src: string;
  alt: string;
}

// Site config types
export interface ContactInfo {
  phone: string;
  email: string;
  address: string;
  kakaoUrl: string;
  naverMapUrl: string;
}

export interface SiteConfig {
  name: string;
  url: string;
  logo: string;
  description: string;
  contact: ContactInfo;
  vatNotice: string;
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
