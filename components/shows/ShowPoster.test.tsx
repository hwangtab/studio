import { render } from '@testing-library/react';

import ShowPoster from './ShowPoster';
import ShowCard from './ShowCard';
import ShowLineup from './ShowLineup';
import { fundingMediaDimensions } from '../../lib/funding/mediaPath';

const UPLOADED = '/api/funding/media/12-abc.webp?w=900&h=1260';

describe('업로드 이미지 공연 화면', () => {
  it('ShowPoster는 업로드 주소를 최적화기에 보내지 않고 ?w=&h= 로 크기를 안다', () => {
    const { container } = render(<ShowPoster src={UPLOADED} title="공연" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(UPLOADED);
    expect(img.getAttribute('src')).not.toContain('/_next/image');
    expect(img.getAttribute('width')).toBe('900');
    expect(img.getAttribute('height')).toBe('1260');
  });

  it('ShowPoster는 정적 이미지에는 기존대로 최적화기를 쓴다', () => {
    const { container } = render(<ShowPoster src="/images/shows/x.webp" title="공연" />);
    expect((container.querySelector('img') as HTMLImageElement).getAttribute('src')).toContain('/_next/image');
  });

  it('출연진 사진도 최적화기를 타지 않는다', () => {
    const { container } = render(<ShowLineup performers={[{ name: 'A', bio: null, photo: UPLOADED, sns: null }]} />);
    const src = (container.querySelector('img') as HTMLImageElement).getAttribute('src') as string;
    expect(src).not.toContain('/_next/image');
    expect(src.endsWith(UPLOADED)).toBe(true);
  });

  it('목록 카드 표지도 최적화기를 타지 않는다', () => {
    const show = {
      slug: 's', title: 't', subtitle: null, presenterName: 'p', coverImage: UPLOADED, venueName: 'v',
      cancelled: false, ticketTypes: [{ id: 'a', name: 'n', price: 1000, zoneLabel: 'z' }],
      showtimes: [{ id: 'x', startsAt: 2000000000, label: 'l', saleState: 'open', remaining: { a: 1 } }],
    } as never;
    const { container } = render(<ShowCard show={show} nowSec={1} />);
    const src = (container.querySelector('img') as HTMLImageElement).getAttribute('src') as string;
    expect(src).not.toContain('/_next/image');
    expect(src.endsWith(UPLOADED)).toBe(true);
  });

  it('fundingMediaDimensions는 업로드 주소의 힌트만 읽는다', () => {
    expect(fundingMediaDimensions(UPLOADED)).toEqual({ width: 900, height: 1260 });
    expect(fundingMediaDimensions('/api/funding/media/a.webp')).toBeNull();
    expect(fundingMediaDimensions('/images/x.webp?w=1&h=1')).toBeNull();
    expect(fundingMediaDimensions('/api/funding/media/a.webp?w=0&h=5')).toBeNull();
  });
});
