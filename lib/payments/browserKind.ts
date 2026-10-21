/**
 * 접속 브라우저 분류 — 인앱 브라우저 여부를 가를 만큼만 본다.
 *
 * windowOpen.ts(DB를 쓰는 서버 모듈)에서 떼어 낸 순수 함수다. **이 모듈은 아무것도 import하지 않는다** —
 * 클라이언트 화면(계약서 완료 화면의 카카오톡 인앱 안내)이 가져가도 DB 클라이언트가 번들에 실리지 않는다.
 */

export type PaymentBrowserKind = 'kakaotalk' | 'instagram' | 'facebook' | 'naver' | 'line' | 'mobile' | 'desktop';

export const PAYMENT_BROWSER_LABEL: Record<PaymentBrowserKind, string> = {
  kakaotalk: '카카오톡 인앱',
  instagram: '인스타그램 인앱',
  facebook: '페이스북 인앱',
  naver: '네이버 앱',
  line: '라인 인앱',
  mobile: '모바일 브라우저',
  desktop: '데스크톱',
};

/** 인앱 표식을 먼저 본다 — 인앱 브라우저의 UA에도 Mobile·Safari가 들어 있다. */
export const classifyPaymentBrowser = (userAgent: string | null | undefined): PaymentBrowserKind => {
  const ua = userAgent ?? '';
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'facebook';
  if (/NAVER\(inapp|NAVER\//i.test(ua)) return 'naver';
  if (/\bLine\//.test(ua)) return 'line';
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return 'mobile';
  return 'desktop';
};
