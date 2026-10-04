import { render, screen } from '@testing-library/react';

import ShowVenueMap from './ShowVenueMap';

describe('ShowVenueMap', () => {
  const show = { venueName: '삼청동 라플란드', venueAddress: '서울특별시 종로구 삼청로 83 가동 1층', mapLinks: {} };

  it('주소·구글 임베드 iframe(lazy)·네이버 길찾기 링크를 그린다', () => {
    const { container } = render(<ShowVenueMap show={show} />);
    expect(screen.getByText('서울특별시 종로구 삼청로 83 가동 1층')).toBeTruthy();
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('loading')).toBe('lazy');
    expect(frame.getAttribute('title')).toBe('삼청동 라플란드 위치 지도');
    expect(decodeURIComponent(frame.src.split('q=')[1].split('&')[0])).toBe('삼청동 라플란드 서울특별시 종로구 삼청로 83');
    expect(screen.getByRole('link', { name: '네이버 지도에서 길찾기' }).getAttribute('href')).toContain('map.naver.com');
    expect(screen.getByRole('link', { name: '카카오맵에서 길찾기' }).getAttribute('href')).toContain('map.kakao.com/link/search/');
  });

  it('공연 데이터의 제공자별 주소가 있으면 그것으로 길찾기를 연다', () => {
    render(<ShowVenueMap show={{ ...show, mapLinks: { kakao: 'https://place.map.kakao.com/1' } }} />);
    expect(screen.getByRole('link', { name: '카카오맵에서 길찾기' }).getAttribute('href')).toBe('https://place.map.kakao.com/1');
    expect(screen.getByRole('link', { name: '네이버 지도에서 길찾기' }).getAttribute('href')).toContain('map.naver.com');
  });
});
