// Portfolio types
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
  services: string[];
  featured: boolean;
  artist: string;
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

export interface ProcessStep extends ServiceItem {}

export interface Advantage extends ServiceItem {}

export interface CoreService extends ServiceItem {}

// Pricing types
export interface PricingPlan {
  id: string;
  title: string;
  priceDisplay: string;
  priceValue: number;
  unit?: string;
  description: string;
  features?: string[];
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
  description: string;
  contact: ContactInfo;
  vatNotice: string;
}

export interface SEODefaults {
  title: string;
  description: string;
  keywords: string;
}
