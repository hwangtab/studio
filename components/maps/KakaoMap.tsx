import { useEffect, useRef, useState, type ReactNode } from 'react';
import { geocodeAddress, kakaoMapPinUrl, loadKakaoMaps } from '../../lib/maps/kakaoMap';

type Place = { lat: number; lng: number } | { address: string };

interface KakaoMapProps {
  /** 좌표를 알면 좌표, 모르면 도로명 주소(건물 번호까지 — 층·동 표기를 붙이면 못 찾는다). */
  place: Place;
  /** 핀 제목·카카오맵 링크 이름. */
  name: string;
  title: string;
  height: number;
  className?: string;
  /** SDK를 못 불러오거나(등록 안 된 도메인·차단·시간 초과) 주소를 못 찾으면 대신 그린다. */
  fallback: ReactNode;
}

/**
 * 카카오맵 — 화면 가까이 올 때에야 SDK를 받는다(그 전엔 한 바이트도 받지 않는다). 휠 확대는 끄고 확대 버튼만 둔다
 * (페이지를 스크롤하다 지도가 휠을 잡아먹지 않게). 핀을 누르면 카카오맵에서 그 지점을 연다.
 */
export default function KakaoMap({ place, name, title, height, className, fallback }: KakaoMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');
  const placeKey = 'address' in place ? place.address : `${place.lat},${place.lng}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    const draw = async () => {
      try {
        const maps = await loadKakaoMaps();
        const pos = 'address' in place ? await geocodeAddress(maps, place.address) : place;
        if (cancelled) return;
        if (!pos) throw new Error('kakao maps: address not found');
        const center = new maps.LatLng(pos.lat, pos.lng);
        const map = new maps.Map(el, { center, level: 3 });
        map.setZoomable(false);
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        const marker = new maps.Marker({ position: center, map, title: name });
        maps.event.addListener(marker, 'click', () => {
          window.open(kakaoMapPinUrl(name, pos.lat, pos.lng), '_blank', 'noopener,noreferrer');
        });
        setState('ready');
      } catch {
        if (!cancelled) setState('failed');
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      void draw();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void draw();
        }
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
    // place는 매 렌더 새 객체라 값(placeKey)으로 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, name]);

  if (state === 'failed') return <>{fallback}</>;
  return (
    <div
      ref={ref}
      role="region"
      aria-label={title}
      aria-busy={state !== 'ready'}
      className={`w-full bg-gray-100 dark:bg-gray-800 ${className ?? ''}`}
      style={{ height }}
    />
  );
}
