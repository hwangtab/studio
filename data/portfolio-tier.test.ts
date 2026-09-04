/** @jest-environment node */

/**
 * 발매 프로젝트 티어 디스코그래피 선택.
 *
 * 예전엔 세 티어(single·ep·album) 페이지가 featured 전체를 그대로 보여줘, 정규앨범
 * 문의자가 싱글 위주 목록을 봤다. 이제 티어에 맞는 카테고리를 앞세우고, 부족하면
 * 인접 카테고리로 12칸을 채운다(빈 섹션 방지).
 */
import { getTierPortfolioItems } from './portfolio';

describe('getTierPortfolioItems', () => {
  it('single 티어는 싱글만 보여준다', () => {
    const items = getTierPortfolioItems('ko', 'single');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.category === 'single')).toBe(true);
  });

  it('album 티어는 앨범/컴필레이션을 앞세운다', () => {
    const items = getTierPortfolioItems('ko', 'album');
    // 상단은 반드시 앨범 계열 — 싱글이 맨 앞에 오면 안 된다.
    expect(items[0].category).toBe('album');
    expect(['album', 'compilation']).toContain(items[1].category);
  });

  /** 자이 <Golden Hour>·엉아들 <Self-titled>이 EP로 분류돼 있다(2026-09-04 운영자 확인). */
  it('ep 티어는 EP를 맨 앞에 세우고 부족분을 앨범으로 채운다', () => {
    const items = getTierPortfolioItems('ko', 'ep');
    expect(items[0].category).toBe('ep');
    // EP가 12건에 못 미치므로 앨범이 뒤를 잇는다 — 싱글보다 앞이어야 한다.
    const firstAlbum = items.findIndex((i) => i.category === 'album');
    const firstSingle = items.findIndex((i) => i.category === 'single');
    expect(firstAlbum).toBeGreaterThan(-1);
    expect(firstAlbum).toBeLessThan(firstSingle);
  });

  it('12건을 넘지 않고, 중복 없이 채운다', () => {
    const items = getTierPortfolioItems('ko', 'album');
    expect(items.length).toBeLessThanOrEqual(12);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('티어 카테고리가 부족하면 featured 전체로 12칸을 채운다(빈 섹션 방지)', () => {
    // album 계열(album+compilation)이 12 미만이라도 featured 싱글로 채워진다.
    const items = getTierPortfolioItems('ko', 'album');
    expect(items.length).toBe(12);
  });
});
