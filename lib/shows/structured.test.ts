import { descriptionBlocks, showMapEmbedUrl, showMapQuery, descriptionParagraphs, parseNoticesJson, parsePerformersJson, performerNames, serializeNotices, serializePerformers, showMapUrl } from './structured';

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

  it('지도 검색어는 층·동 표기를 잘라 도로명 주소까지만 쓴다', () => {
    const v = (venueAddress: string) => showMapQuery({ venueName: '삼청동 라플란드', venueAddress });
    expect(v('서울특별시 종로구 삼청로 83 가동 1층')).toBe('삼청동 라플란드 서울특별시 종로구 삼청로 83');
    expect(v('서울 마포구 와우산로 94 2층')).toBe('삼청동 라플란드 서울 마포구 와우산로 94');
    expect(v('서울 마포구 와우산로 94 지하 1층')).toBe('삼청동 라플란드 서울 마포구 와우산로 94');
    expect(v('서울 마포구 와우산로 94 B1층')).toBe('삼청동 라플란드 서울 마포구 와우산로 94');
    expect(v('서울 마포구 와우산로 94-3')).toBe('삼청동 라플란드 서울 마포구 와우산로 94-3');
    expect(v('서울 종로구 삼청로 83')).toBe('삼청동 라플란드 서울 종로구 삼청로 83');
  });

  it('지도 임베드 주소는 구글 임베드이고 검색어가 인코딩된다', () => {
    const url = showMapEmbedUrl({ venueName: '삼청동 라플란드', venueAddress: '서울특별시 종로구 삼청로 83 가동 1층' });
    expect(url.startsWith('https://www.google.com/maps?q=')).toBe(true);
    expect(url).toContain('output=embed');
    expect(decodeURIComponent(url.split('q=')[1].split('&')[0])).toBe('삼청동 라플란드 서울특별시 종로구 삼청로 83');
  });

  it('소개 블록: ## 는 소제목, > 는 인용(여러 줄 유지), 나머지는 문단', () => {
    const blocks = descriptionBlocks('첫 문단\n\n## 제목\n\n> "말"\n— 누구\n\n끝 문단');
    expect(blocks).toEqual([
      { type: 'p', text: '첫 문단' },
      { type: 'h', text: '제목' },
      { type: 'quote', text: '"말"\n— 누구' },
      { type: 'p', text: '끝 문단' },
    ]);
  });
});
