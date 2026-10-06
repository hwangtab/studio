import { Button } from '../ui/Button';
import type { PublicShow } from '../../lib/shows/queries';
import { showMapEmbedUrl, showMapLinks, showMapStreet } from '../../lib/shows/maps';
import KakaoMap from '../maps/KakaoMap';

/**
 * 오시는 길 — 공연장 지도(카카오맵) + 주소 + 지도 앱 길찾기 버튼들. 연락처 페이지(ContactInfoCard)와 같은
 * KakaoMap이고, 공연장 좌표는 도로명 주소(건물 번호까지, showMapStreet)로 카카오 주소 검색을 해 얻는다. 카카오맵을
 * 못 띄우면(프리뷰 도메인·차단·주소 못 찾음) 구글 임베드 iframe으로 물러선다. 값은 공연 데이터(DB)에서 온다. 버튼은 지도 제공자 목록
 * (lib/shows/maps.ts SHOW_MAP_PROVIDERS)을 돌아 만들므로 제공자가 늘면 코드 수정 없이 버튼이 늘어난다.
 */
export default function ShowVenueMap({ show }: { show: Pick<PublicShow, 'venueName' | 'venueAddress' | 'mapLinks'> }) {
  const links = showMapLinks(show);
  return (
    <div>
      <p className="typo-card-subtitle text-gray-900 dark:text-white">{show.venueName}</p>
      <p className="typo-card-body mt-1">{show.venueAddress}</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <KakaoMap
          place={{ address: showMapStreet(show) }}
          name={show.venueName}
          title={`${show.venueName} 위치 지도`}
          height={320}
          fallback={
            <iframe
              src={showMapEmbedUrl(show)}
              title={`${show.venueName} 위치 지도`}
              width="100%"
              height="320"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          }
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Button key={l.id} asChild variant="outline" shape="block">
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label}에서 길찾기
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
