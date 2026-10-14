import type { SoftwareProduct } from '../../data/software/catalog';

/** 소프트웨어 통합 테스트용 상품. `data/software/catalog`의 SOFTWARE_PRODUCTS를 이 값으로 바꿔 끼운다. */
export const SOFTWARE_FIXTURE_PRODUCTS: SoftwareProduct[] = [
  {
    slug: 'test-plugin',
    kind: 'plugin',
    title: '테스트 플러그인',
    titleEn: 'Test Plugin',
    summary: '테스트',
    summaryEn: 'Test',
    description: ['테스트 설명'],
    descriptionEn: ['Test description'],
    formats: ['VST3', 'AU'],
    platforms: ['macos', 'windows'],
    requirements: [],
    requirementsEn: [],
    maxActivations: 2,
    prices: [{ id: 'test-plugin-v2', krw: 69000 }, { id: 'test-plugin-v1', krw: 59000 }],
    releases: [
      { version: '1.1.0', date: '2026-11-01', notes: ['고침'], notesEn: ['Fixes'], downloads: [] },
      { version: '1.0.0', date: '2026-10-20', notes: ['첫 공개'], notesEn: ['First release'], downloads: [] },
    ],
    published: true,
  },
  {
    slug: 'test-app',
    kind: 'app',
    title: '테스트 앱',
    titleEn: 'Test App',
    summary: '테스트',
    summaryEn: 'Test',
    description: ['테스트 설명'],
    descriptionEn: ['Test description'],
    formats: ['Standalone'],
    platforms: ['macos'],
    requirements: [],
    requirementsEn: [],
    releases: [],
    published: false,
  },
];
