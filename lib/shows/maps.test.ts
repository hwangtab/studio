import { parseMapLinksJson, serializeMapLinks, SHOW_MAP_PROVIDERS, showMapEmbedUrl, showMapLinks, showMapQuery, showMapStreet, validateMapLinks } from './maps';

const venue = { venueName: '삼청동 라플란드', venueAddress: '서울특별시 종로구 삼청로 83 가동 1층' };

describe('공연장 지도 틀', () => {
  it('건물 안쪽 표기(동·층)를 떼고 건물 번호까지만 쓴다', () => {
    const street = (venueAddress: string) => showMapStreet({ venueAddress });
    expect(street('서울특별시 종로구 삼청로 83 가동 1층')).toBe('서울특별시 종로구 삼청로 83');
    expect(street('서울특별시 종로구 삼청로 83 가동 2층')).toBe('서울특별시 종로구 삼청로 83'); // 층이 바뀌어도 같은 건물을 찾는다
    expect(street('서울 마포구 와우산로 94 2층')).toBe('서울 마포구 와우산로 94');
    expect(street('서울 마포구 와우산로 94 지하 1층')).toBe('서울 마포구 와우산로 94');
    expect(street('서울 마포구 와우산로 94 B1층')).toBe('서울 마포구 와우산로 94');
    expect(street('서울 마포구 와우산로 94-3')).toBe('서울 마포구 와우산로 94-3');
    expect(showMapQuery(venue)).toBe('삼청동 라플란드 서울특별시 종로구 삼청로 83');
  });

  it('제공자마다 검색어가 다르다 — 네이버는 장소명+주소, 카카오는 주소만(합치면 결과가 없다)', () => {
    const [naver, kakao] = showMapLinks(venue);
    expect(naver.id).toBe('naver');
    expect(decodeURIComponent(naver.url.split('/search/')[1])).toBe('삼청동 라플란드 서울특별시 종로구 삼청로 83');
    expect(kakao.id).toBe('kakao');
    expect(kakao.url.startsWith('https://map.kakao.com/link/search/')).toBe(true);
    expect(decodeURIComponent(kakao.url.split('/search/')[1])).toBe('서울특별시 종로구 삼청로 83');
    expect([naver.custom, kakao.custom]).toEqual([false, false]);
  });

  it('공연 정의의 제공자별 주소가 검색보다 우선이고, 나머지는 검색을 쓴다', () => {
    const links = showMapLinks({ ...venue, mapLinks: { kakao: 'https://place.map.kakao.com/123' } });
    expect(links.find((l) => l.id === 'kakao')).toMatchObject({ url: 'https://place.map.kakao.com/123', custom: true });
    expect(links.find((l) => l.id === 'naver')?.custom).toBe(false);
  });

  it('제공자 목록이 곧 버튼 목록이다 — 순서는 목록 순서', () => {
    expect(showMapLinks(venue).map((l) => l.id)).toEqual(SHOW_MAP_PROVIDERS.map((p) => p.id));
  });

  it('지도 임베드 주소는 구글 임베드이고 검색어가 인코딩된다', () => {
    const url = showMapEmbedUrl(venue);
    expect(url.startsWith('https://www.google.com/maps?q=')).toBe(true);
    expect(url).toContain('output=embed');
    expect(decodeURIComponent(url.split('q=')[1].split('&')[0])).toBe('삼청동 라플란드 서울특별시 종로구 삼청로 83');
  });

  it('저장 형식: 왕복·빈 값은 null, 알 수 없는 제공자·https 아닌 주소·깨진 JSON은 버린다', () => {
    expect(serializeMapLinks(undefined)).toBeNull();
    expect(serializeMapLinks({})).toBeNull();
    const text = serializeMapLinks({ naver: 'https://naver.me/x' });
    expect(parseMapLinksJson(text)).toEqual({ naver: 'https://naver.me/x' });
    expect(parseMapLinksJson('{"naver":"http://x","google":"https://g","kakao":"https://k"}')).toEqual({ kakao: 'https://k' });
    expect(parseMapLinksJson('{bad')).toEqual({});
    expect(parseMapLinksJson(null)).toEqual({});
  });

  it('정의 검증: 알 수 없는 제공자와 https 아닌 주소를 거부한다', () => {
    expect(validateMapLinks({ naver: 'https://naver.me/x' })).toEqual([]);
    expect(validateMapLinks({ google: 'https://g' }).some((e) => e.includes('알 수 없는'))).toBe(true);
    expect(validateMapLinks({ kakao: 'http://k' }).some((e) => e.includes('https'))).toBe(true);
  });
});
