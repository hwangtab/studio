import { Button } from '../ui/Button';
import type { PublicShow } from '../../lib/shows/queries';
import { showMapEmbedUrl, showMapUrl } from '../../lib/shows/structured';

/**
 * 오시는 길 — 공연장 지도(구글 임베드) + 주소 + 네이버 지도 링크. 연락처 페이지(ContactInfoCard)와 같은 방식의
 * iframe(lazy·no-referrer-when-downgrade)이고, 주소는 공연 데이터(DB)에서 온다. 공연이 바뀌어도 코드는 그대로다.
 */
export default function ShowVenueMap({ show }: { show: Pick<PublicShow, 'venueName' | 'venueAddress' | 'mapUrl'> }) {
  return (
    <div>
      <p className="typo-card-subtitle text-gray-900 dark:text-white">{show.venueName}</p>
      <p className="typo-card-body mt-1">{show.venueAddress}</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
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
      </div>
      <div className="mt-4">
        <Button asChild variant="outline" shape="block">
          <a href={showMapUrl({ ...show })} target="_blank" rel="noopener noreferrer">
            네이버 지도에서 길찾기
          </a>
        </Button>
      </div>
    </div>
  );
}
