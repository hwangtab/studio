/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import { SUPPORTED_ARTISTS, getSupportedArtist, getArtistPortfolioItems } from './index';
import { getPortfolioItems } from '../portfolio';

describe('data/artists', () => {
  it('slug는 소문자·숫자·하이픈이며 중복이 없다', () => {
    const slugs = SUPPORTED_ARTISTS.map((a) => a.slug);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('portfolioArtist는 포트폴리오에 실제로 존재하는 아티스트명이다', () => {
    const known = new Set(getPortfolioItems('ko').map((i) => i.artist));
    for (const a of SUPPORTED_ARTISTS) expect(known).toContain(a.portfolioArtist);
  });

  it('이미지 파일이 저장소에 존재한다', () => {
    for (const a of SUPPORTED_ARTISTS) {
      expect(a.image).toMatch(/^\/images\/artists\/[a-z0-9-]+\.(jpg|jpeg|png)$/);
      expect(fs.existsSync(path.join(process.cwd(), 'public', a.image))).toBe(true);
    }
  });

  it('날짜는 ISO(YYYY-MM-DD)이고 updatedOn >= joinedOn', () => {
    for (const a of SUPPORTED_ARTISTS) {
      expect(a.joinedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.updatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.updatedOn >= a.joinedOn).toBe(true);
    }
  });

  it('getSupportedArtist는 없는 slug에 null을 돌려준다', () => {
    expect(getSupportedArtist('no-such-artist')).toBeNull();
  });

  it('getArtistPortfolioItems는 featured를 앞에, 그 다음 발매일 내림차순으로 준다', () => {
    const sample = { slug: 'x', name: 'x', portfolioArtist: '자이', tagline: '', bio: '', image: '/images/artists/x.jpg',
      links: {}, supportActive: false, taxType: 'withholding', joinedOn: '2026-09-08', updatedOn: '2026-09-08' } as const;
    const items = getArtistPortfolioItems(sample, 'ko');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.artist === '자이')).toBe(true);
    const firstNonFeatured = items.findIndex((i) => !i.featured);
    if (firstNonFeatured > 0) expect(items.slice(0, firstNonFeatured).every((i) => i.featured)).toBe(true);
  });
});
