/**
 * 카카오(다음) 우편번호 서비스 로더. 키가 필요 없는 무료 서비스다.
 *
 * 폼을 연 모든 사람이 받을 필요는 없으므로 **주소 검색을 처음 누를 때** 한 번 불러온다.
 * 스크립트는 단독 파일이고(다른 스크립트를 더 부르지 않는다), 검색 화면은
 * `postcode.map.kakao.com` iframe으로 뜬다 — middleware.ts CSP의 script-src·frame-src에
 * 두 출처가 들어 있어야 한다. 빠지면 로드는 되는데 검색 창이 빈칸으로 뜬다.
 */
export const KAKAO_POSTCODE_SCRIPT = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

/** 우편번호 서비스가 넘겨주는 결과 중 이 폼이 쓰는 값만. */
export interface KakaoPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: 'R' | 'J';
  bname: string;
  buildingName: string;
  apartment: 'Y' | 'N';
}

export interface KakaoPostcodeInstance {
  embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void;
}

export type KakaoPostcodeCtor = new (options: {
  oncomplete: (data: KakaoPostcodeData) => void;
  width?: string | number;
  height?: string | number;
}) => KakaoPostcodeInstance;

declare global {
  interface Window {
    daum?: { Postcode?: KakaoPostcodeCtor };
  }
}

let pending: Promise<KakaoPostcodeCtor> | null = null;

export function loadKakaoPostcode(): Promise<KakaoPostcodeCtor> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.daum?.Postcode) return Promise.resolve(window.daum.Postcode);
  if (pending) return pending;
  pending = new Promise<KakaoPostcodeCtor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = KAKAO_POSTCODE_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.daum?.Postcode) resolve(window.daum.Postcode);
      else reject(new Error('postcode unavailable'));
    };
    script.onerror = () => reject(new Error('postcode script failed'));
    document.head.appendChild(script);
  }).catch((err) => {
    // 실패를 기억하지 않는다 — 네트워크가 잠깐 끊겼던 거라면 다시 누를 때 재시도한다.
    pending = null;
    throw err;
  });
  return pending;
}

/**
 * 결과를 주소 한 줄로. 도로명 주소를 고르면 카카오 가이드대로 법정동·아파트 이름을
 * 괄호로 붙인다(택배 기사가 건물을 찾기 쉽다). 지번을 고르면 지번 주소 그대로.
 */
export function formatKakaoAddress(data: KakaoPostcodeData): string {
  if (data.userSelectedType === 'J') return data.jibunAddress;
  const extra = [
    data.bname && /[동로가]$/.test(data.bname) ? data.bname : '',
    data.buildingName && data.apartment === 'Y' ? data.buildingName : '',
  ].filter(Boolean).join(', ');
  return extra ? `${data.roadAddress} (${extra})` : data.roadAddress;
}
