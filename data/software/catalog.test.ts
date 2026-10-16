import { SOFTWARE_FIXTURE_PRODUCTS } from '../../tests/helpers/softwareFixtures';
import { SOFTWARE_PRODUCTS, type SoftwareProduct } from './catalog';
import { SOFTWARE_LICENSE_PUBLIC_KEYS } from './publicKeys';
import { SOFTWARE_RESERVED_SLUGS } from './policy';
import { isSafeObjectKey } from '../../lib/funding/objectKey';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const compareVersion = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

/** 카탈로그 한 벌의 문제 목록. 실제 카탈로그와 테스트 픽스처에 같이 건다. */
const problemsOf = (products: readonly SoftwareProduct[]): string[] => {
  const out: string[] = [];
  const slugs = new Set<string>();
  const priceIds = new Set<string>();
  for (const p of products) {
    if (!SLUG.test(p.slug)) out.push(`${p.slug}: slug 형식`);
    if (SOFTWARE_RESERVED_SLUGS.includes(p.slug)) out.push(`${p.slug}: 예약어`);
    if (slugs.has(p.slug)) out.push(`${p.slug}: slug 중복`);
    slugs.add(p.slug);
    if (p.formats.length === 0 || p.platforms.length === 0) out.push(`${p.slug}: 포맷·OS가 비었다`);
    if (p.description.length === 0 || p.descriptionEn.length === 0) out.push(`${p.slug}: 설명이 비었다`);
    if (p.trialDays !== undefined && (!Number.isInteger(p.trialDays) || p.trialDays < 1)) out.push(`${p.slug}: trialDays`);
    if (p.maxActivations !== undefined && (!Number.isInteger(p.maxActivations) || p.maxActivations < 1)) out.push(`${p.slug}: maxActivations`);
    for (const pr of p.prices ?? []) {
      if (!SLUG.test(pr.id)) out.push(`${pr.id}: 가격 id 형식`);
      if (priceIds.has(pr.id)) out.push(`${pr.id}: 가격 id 중복`);
      priceIds.add(pr.id);
      if (!Number.isInteger(pr.krw) || pr.krw <= 0) out.push(`${pr.id}: 원화 금액`);
      if (pr.usdCents !== undefined && (!Number.isInteger(pr.usdCents) || pr.usdCents <= 0)) out.push(`${pr.id}: 달러(센트) 금액`);
    }
    const versions = new Set<string>();
    p.releases.forEach((r, i) => {
      if (!VERSION.test(r.version)) out.push(`${p.slug} ${r.version}: 버전 형식`);
      if (!DATE.test(r.date)) out.push(`${p.slug} ${r.version}: 날짜 형식`);
      if (versions.has(r.version)) out.push(`${p.slug} ${r.version}: 버전 중복`);
      versions.add(r.version);
      const prev = p.releases[i - 1];
      if (prev && VERSION.test(prev.version) && VERSION.test(r.version) && compareVersion(prev.version, r.version) <= 0)
        out.push(`${p.slug}: releases는 최신이 맨 앞이어야 한다(${prev.version} 다음 ${r.version})`);
      for (const d of r.downloads) {
        if (!p.platforms.includes(d.platform)) out.push(`${p.slug} ${r.version}: 상품에 없는 OS(${d.platform})의 설치 파일`);
        if (!d.objectKey.startsWith(`software/${p.slug}/${r.version}/`) || !isSafeObjectKey(d.objectKey))
          out.push(`${p.slug} ${r.version}: 설치 파일 키는 software/${p.slug}/${r.version}/<파일> (같은 키에 덮어쓰지 않는다)`);
        if (!/^[0-9a-f]{64}$/.test(d.sha256)) out.push(`${p.slug} ${r.version}: sha256은 소문자 hex 64자`);
        if (!Number.isInteger(d.sizeBytes) || d.sizeBytes <= 0) out.push(`${p.slug} ${r.version}: sizeBytes`);
      }
    });
  }
  return out;
};

describe('소프트웨어 카탈로그', () => {
  it('실제 카탈로그가 규칙을 지킨다', () => {
    expect(problemsOf(SOFTWARE_PRODUCTS)).toEqual([]);
  });

  it('테스트 픽스처도 같은 규칙을 지킨다', () => {
    expect(problemsOf(SOFTWARE_FIXTURE_PRODUCTS)).toEqual([]);
  });

  it('검사가 실제로 잡는다', () => {
    const bad: SoftwareProduct = {
      ...SOFTWARE_FIXTURE_PRODUCTS[0],
      slug: 'manage',
      releases: [
        { version: '1.0.0', date: '2026-10-20', notes: [], notesEn: [], downloads: [{ platform: 'macos', objectKey: 'software/manage/plugin.dmg', sha256: 'ABC', sizeBytes: 1 }] },
        { version: '1.1.0', date: '2026-11-01', notes: [], notesEn: [], downloads: [] },
      ],
    };
    const problems = problemsOf([bad]).join('\n');
    expect(problems).toMatch('예약어');
    expect(problems).toMatch('최신이 맨 앞');
    expect(problems).toMatch('설치 파일 키는');
    expect(problems).toMatch('sha256');
  });

  it('공개키는 raw 32바이트 base64', () => {
    for (const [kid, key] of Object.entries(SOFTWARE_LICENSE_PUBLIC_KEYS)) {
      expect(kid).toMatch(/^[a-z0-9-]{1,16}$/);
      expect(Buffer.from(key, 'base64')).toHaveLength(32);
    }
  });
});
