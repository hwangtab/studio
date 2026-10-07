/**
 * 카카오맵 JavaScript SDK 로더 — 한국어 페이지의 지도(연락처·공연장)가 쓴다.
 *
 * **키는 공개값이다.** JavaScript 키는 브라우저에 그대로 실리는 값이라 env로 숨길 이유가 없고, 남용은 카카오
 * 디벨로퍼스의 "JavaScript SDK 도메인" 등록이 막는다(등록되지 않은 출처에서는 SDK가 지도를 그리지 않는다).
 * 앱은 카카오 디벨로퍼스 "스튜디오 놀"(ID 1235085, 2026-10-07 옛 오피스아트 앱을 전환) — 계정의 카카오맵 일간
 * 무료 쿼터가 이 앱에 붙어 있다. **새 앱을 만들어 키를 바꾸지 말 것** — 무료 쿼터는 계정당 처음 켠 앱 하나뿐이라
 * 새 앱은 월렛 연결(사용량 과금)을 요구한다. 등록 도메인: studionol.co.kr·www.studionol.co.kr·localhost:3000·3100
 * (그리고 씨앗페 saf2026.com — 그 사이트 지도가 같은 키를 쓴다, 지우지 말 것). Vercel 프리뷰 주소는 등록돼 있지
 * 않아 프리뷰에서는 지도가 폴백(구글 임베드)으로 뜬다 — 정상이다.
 *
 * 스크립트는 `autoload=false`로 받아 `kakao.maps.load`로 띄운다. 로더(dapi.kakao.com)가 본체·services 라이브러리를
 * t1.kakaocdn.net에서 더 부르므로 middleware.ts CSP script-src에 둘 다 있어야 한다. 지도 타일(mts.kakaocdn.net)은
 * img-src https:로 통과. **주소 검색은 dapi.kakao.com으로 가는 XHR이라 connect-src에도 있어야 한다** — 빠지면 콜백이
 * 영영 오지 않는다(2026-10-07 실측). 그래서 geocodeAddress에 타임아웃을 둔다.
 */
export const KAKAO_MAP_JS_KEY = '9b52ab4382965154f8f524a4c8c37099';

const SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_JS_KEY}&autoload=false&libraries=services`;

/** 이 저장소가 쓰는 SDK 표면만. */
export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
export interface KakaoMapInstance {
  addControl(control: unknown, position: unknown): void;
  setZoomable(zoomable: boolean): void;
  relayout(): void;
  setCenter(latlng: KakaoLatLng): void;
}
export interface KakaoMapsNamespace {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  Marker: new (options: { position: KakaoLatLng; map?: KakaoMapInstance; title?: string }) => unknown;
  ZoomControl: new () => unknown;
  ControlPosition: { RIGHT: unknown };
  event: { addListener(target: unknown, type: string, handler: () => void): void };
  services: {
    Geocoder: new () => {
      addressSearch(address: string, callback: (result: Array<{ x: string; y: string }>, status: string) => void): void;
    };
    Status: { OK: string };
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNamespace };
  }
}

let pending: Promise<KakaoMapsNamespace> | null = null;

/** 처음 부를 때 한 번만 불러온다. 실패하면 다음 호출이 다시 시도할 수 있게 비운다. */
export function loadKakaoMaps(timeoutMs = 10_000): Promise<KakaoMapsNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('kakao maps: no window'));
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps);
  if (pending) return pending;

  pending = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('kakao maps: timeout')), timeoutMs);
    const done = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        window.clearTimeout(timer);
        reject(new Error('kakao maps: sdk missing'));
        return;
      }
      // 등록되지 않은 도메인이면 load 콜백이 오지 않는다 — 위 타이머가 폴백으로 넘긴다.
      maps.load(() => {
        window.clearTimeout(timer);
        resolve(maps);
      });
    };
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = done;
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('kakao maps: script error'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    pending = null;
    throw err;
  });
  return pending;
}

/** 도로명 주소 → 좌표. 결과가 없으면 null. */
export function geocodeAddress(
  maps: KakaoMapsNamespace,
  address: string,
  timeoutMs = 8_000
): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    // 요청이 막히면(CSP·네트워크) SDK는 콜백을 부르지 않는다 — 시간이 지나면 "못 찾음"으로 넘겨 폴백을 띄운다.
    window.setTimeout(() => resolve(null), timeoutMs);
    new maps.services.Geocoder().addressSearch(address, (result, status) => {
      if (status !== maps.services.Status.OK || !result[0]) return resolve(null);
      resolve({ lat: Number(result[0].y), lng: Number(result[0].x) });
    });
  });
}

/** 카카오맵 앱·웹에서 그 지점을 핀으로 여는 주소. */
export const kakaoMapPinUrl = (name: string, lat: number, lng: number): string =>
  `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
