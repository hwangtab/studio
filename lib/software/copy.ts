import type { SoftwareFormat, SoftwarePlatform, SoftwareProduct } from '../../data/software/catalog';

/** 소프트웨어 화면은 ko·en 두 로케일만 연다(공연과 같다). 나머지는 en으로 보낸다. */
export type SoftwareLocale = 'ko' | 'en';

export const toSoftwareLocale = (v: unknown): SoftwareLocale | null => (v === 'ko' || v === 'en' ? v : null);

export const softwarePath = (locale: SoftwareLocale, slug?: string): string => `/${locale}/software${slug ? `/${slug}` : ''}`;

const ko = {
  indexTitle: '소프트웨어',
  indexLead: '스튜디오 놀이 작업실에서 쓰려고 만든 플러그인과 툴이에요.',
  seoIndexTitle: '소프트웨어 | 스튜디오 놀',
  seoIndexDescription: '스튜디오 놀이 만든 오디오 플러그인과 음원 작업 툴. 체험판을 받아 써 보고 고를 수 있어요.',
  emptyTitle: '준비 중이에요',
  emptyDescription: '플러그인과 툴을 곧 올릴게요.',
  backToIndex: '소프트웨어 목록',
  formats: '포맷',
  platforms: '운영체제',
  requirements: '필요 사양',
  latest: '최신 버전',
  changelog: '변경 내역',
  trialHeading: '체험판',
  trialBody: (days: number) => `모든 기능을 ${days}일 동안 써 볼 수 있어요. 정식판과 같은 설치 파일이라, 나중에 라이선스 키만 넣으면 그대로 정식판이 돼요.`,
  download: (platform: string) => `${platform}용 받기`,
  checksum: 'SHA-256',
  noDownload: '설치 파일을 준비하고 있어요.',
  salesClosedHeading: '판매 준비 중',
  salesClosedBody: '구매는 곧 열어요. 그전까지 체험판으로 써 보세요.',
  kind: { plugin: '플러그인', app: '앱' },
};

const en: typeof ko = {
  indexTitle: 'Software',
  indexLead: 'Plugins and tools we built for our own studio work.',
  seoIndexTitle: 'Software | Studio NOL',
  seoIndexDescription: 'Audio plugins and music production tools made by Studio NOL. Download a trial and try before you buy.',
  emptyTitle: 'Coming soon',
  emptyDescription: 'Our plugins and tools will be listed here soon.',
  backToIndex: 'All software',
  formats: 'Formats',
  platforms: 'Platforms',
  requirements: 'Requirements',
  latest: 'Latest version',
  changelog: 'Changelog',
  trialHeading: 'Free trial',
  trialBody: (days: number) => `Every feature works for ${days} days. The trial is the same installer as the full version — enter a license key later and it becomes the full version.`,
  download: (platform: string) => `Download for ${platform}`,
  checksum: 'SHA-256',
  noDownload: 'Installers are on the way.',
  salesClosedHeading: 'Not on sale yet',
  salesClosedBody: 'Purchasing opens soon. Until then, try the trial.',
  kind: { plugin: 'Plugin', app: 'App' },
};

export const SOFTWARE_COPY: Record<SoftwareLocale, typeof ko> = { ko, en };

export const PLATFORM_LABEL: Record<SoftwarePlatform, string> = { macos: 'macOS', windows: 'Windows' };

export const formatList = (formats: readonly SoftwareFormat[]): string => formats.join(' · ');

/** 상품의 로케일별 글. */
export const localizedProduct = (p: SoftwareProduct, locale: SoftwareLocale) => ({
  title: locale === 'ko' ? p.title : p.titleEn,
  summary: locale === 'ko' ? p.summary : p.summaryEn,
  description: locale === 'ko' ? p.description : p.descriptionEn,
  requirements: locale === 'ko' ? p.requirements : p.requirementsEn,
});

export const formatBytes = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
