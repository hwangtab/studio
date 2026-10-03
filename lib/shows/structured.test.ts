import { descriptionParagraphs, parseNoticesJson, parsePerformersJson, performerNames, serializeNotices, serializePerformers, showMapUrl } from './structured';

describe('shows 구조화 칸 직렬화', () => {
  it('출연진은 왕복이 되고 빈 선택값은 저장하지 않는다', () => {
    const list = [{ name: '자이', bio: '싱어송라이터', photo: '/images/shows/a.webp' }, { name: '솔가', bio: null, photo: null, sns: null }];
    const text = serializePerformers(list);
    expect(text).toBe('[{"name":"자이","bio":"싱어송라이터","photo":"/images/shows/a.webp"},{"name":"솔가"}]');
    expect(parsePerformersJson(text)).toEqual([
      { name: '자이', bio: '싱어송라이터', photo: '/images/shows/a.webp', sns: null },
      { name: '솔가', bio: null, photo: null, sns: null },
    ]);
    expect(performerNames(list)).toBe('자이, 솔가');
  });

  it('깨진 JSON·이름 없는 항목은 조용히 버린다 — 상세가 500이 되면 안 된다', () => {
    expect(parsePerformersJson('{not json')).toEqual([]);
    expect(parsePerformersJson(null)).toEqual([]);
    expect(parsePerformersJson('[{"bio":"x"},{"name":""},{"name":"ok"}]')).toEqual([{ name: 'ok', bio: null, photo: null, sns: null }]);
    expect(parseNoticesJson('"str"')).toEqual([]);
    expect(parseNoticesJson(serializeNotices(['a', '', 'b']))).toEqual(['a', 'b']);
  });

  it('문단은 빈 줄로 가르고, 지도는 등록값이 우선이다', () => {
    expect(descriptionParagraphs('a\n\n\nb\nc\n\n')).toEqual(['a', 'b\nc']);
    expect(showMapUrl({ mapUrl: 'https://naver.me/x', venueName: 'v', venueAddress: 'a' })).toBe('https://naver.me/x');
    expect(showMapUrl({ mapUrl: null, venueName: '라플란드', venueAddress: '삼청로 83' })).toContain('map.naver.com/p/search/');
  });
});
