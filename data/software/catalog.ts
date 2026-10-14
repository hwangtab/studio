/**
 * 소프트웨어(오디오 플러그인·데스크톱 툴) 상품 정본 — 이름·설명·가격·릴리스는 **여기서만** 읽는다.
 * 라이선스·기기 활성화는 DB(`software_licenses`·`software_activations`)가 들고, 관리자 `/admin/software`에서 발급한다.
 *
 * **이 모듈은 아무것도 import하지 않는다** — 상품 화면(클라이언트 번들)과 서버가 같은 값을 쓴다.
 *
 * ## 지켜야 할 것
 *
 * - **판매를 시작한 가격 id의 금액은 바꾸지 않는다.** 가격을 바꾸려면 새 id로 더한다.
 *   `data/software/catalog.baseline.test.ts`가 지우기·금액 변경을 막는다.
 * - slug는 소문자·숫자·하이픈. `manage`·`success`·`fail`은 페이지 이름이라 쓸 수 없다.
 * - `releases`는 **최신이 맨 앞**이다(`latest` API·화면이 첫 항목을 최신으로 읽는다). 버전은 `1.2.3` 형식,
 *   설치 파일 주소는 버전이 박힌 새 경로로 올린다(같은 경로에 덮어쓰지 않는다 — sha256이 어긋난다).
 * - 체험판과 정식판은 같은 설치 파일이다. 라이선스 파일이 들어오면 정식으로 바뀐다.
 *
 * ## 상품 예시 (복사해서 SOFTWARE_PRODUCTS에 넣는다)
 *
 * ```ts
 * {
 *   slug: 'example-plugin',
 *   kind: 'plugin',
 *   title: '예시 플러그인',
 *   titleEn: 'Example Plugin',
 *   summary: '한 줄 소개',
 *   summaryEn: 'One-line summary',
 *   description: ['첫 문단은 평문 — 검색 요약이 여기서 나온다.'],
 *   descriptionEn: ['First paragraph in plain text.'],
 *   formats: ['VST3', 'AU'],
 *   platforms: ['macos', 'windows'],
 *   requirements: ['macOS 12 이상 · Apple Silicon·Intel', 'Windows 10 이상 64비트'],
 *   requirementsEn: ['macOS 12 or later, Apple Silicon and Intel', 'Windows 10 or later, 64-bit'],
 *   trialDays: 30,
 *   maxActivations: 3,
 *   prices: [{ id: 'example-plugin-v1', krw: 59000, usdCents: 4900 }],
 *   releases: [{
 *     version: '1.0.0', date: '2026-11-01', notes: ['첫 공개'], notesEn: ['First release'],
 *     downloads: [{ platform: 'macos', url: 'https://…/example-plugin-1.0.0.dmg', sha256: '<64자 hex>', sizeBytes: 12345678 }],
 *   }],
 *   published: true,
 * }
 * ```
 */

export type SoftwareKind = 'plugin' | 'app';
export type SoftwareFormat = 'VST3' | 'AU' | 'AAX' | 'Standalone';
export type SoftwarePlatform = 'macos' | 'windows';

export interface SoftwarePrice {
  /** 전역에서 겹치지 않는 id(소문자·숫자·하이픈). 판매 시작 뒤 금액을 바꾸지 않는다. */
  id: string;
  /** VAT 포함 판매가(원). */
  krw: number;
  /** 해외 판매가(센트). 해외 결제를 열 때 쓴다. */
  usdCents?: number;
}

export interface SoftwareDownload {
  platform: SoftwarePlatform;
  url: string;
  /** 설치 파일의 SHA-256(소문자 hex 64자). */
  sha256: string;
  sizeBytes: number;
}

export interface SoftwareRelease {
  /** `1.2.3` */
  version: string;
  /** `YYYY-MM-DD` */
  date: string;
  notes: string[];
  notesEn: string[];
  downloads: SoftwareDownload[];
}

export interface SoftwareProduct {
  slug: string;
  kind: SoftwareKind;
  title: string;
  titleEn: string;
  summary: string;
  summaryEn: string;
  /** 문단 배열. 첫 문단은 평문이어야 한다(검색 요약). */
  description: string[];
  descriptionEn: string[];
  formats: SoftwareFormat[];
  platforms: SoftwarePlatform[];
  requirements: string[];
  requirementsEn: string[];
  /** 체험 기간(일). 기본 `SOFTWARE_DEFAULT_TRIAL_DAYS`. */
  trialDays?: number;
  /** 라이선스 한 개당 동시에 활성화할 수 있는 기기 수. 기본 `SOFTWARE_DEFAULT_MAX_ACTIVATIONS`. */
  maxActivations?: number;
  /** 판매 가격(결제 단계에서 쓴다). 비우면 판매하지 않는 상품. */
  prices?: SoftwarePrice[];
  /** 최신이 맨 앞. */
  releases: SoftwareRelease[];
  /** false면 목록·상세·latest API에 나오지 않는다. */
  published: boolean;
}

export const SOFTWARE_PRODUCTS: readonly SoftwareProduct[] = [];
