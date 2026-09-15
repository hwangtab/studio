import { useSyncExternalStore } from 'react';

/**
 * 애플페이로 결제할 수 있는 환경인지.
 *
 * 토스 애플페이는 **PC는 Safari, 모바일은 iOS**에서만 동작하고, 정확히 그 환경에서만
 * `window.ApplePaySession`이 있다(맥 크롬·안드로이드·윈도우에는 없다). 그래서 UA를 뜯어보는
 * 대신 이 객체의 존재로 판정한다 — 토스의 지원 범위와 그대로 맞고 오탐이 없다.
 *
 * 서버 스냅샷은 항상 false다. 첫 렌더에서 목록에 넣었다가 클라이언트에서 빼면 hydration이
 * 어긋나므로, 지원 기기에서 **나중에 추가되는** 방향으로만 움직이게 한다. 지원 여부는 한
 * 세션 안에서 바뀌지 않으니 구독은 아무 일도 하지 않는다.
 */
const subscribe = () => () => {};

const getClientSnapshot = (): boolean => {
  try {
    const applePay = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
    return typeof applePay?.canMakePayments === 'function' && applePay.canMakePayments() === true;
  } catch {
    // 보안 컨텍스트 밖에서는 canMakePayments가 예외를 던진다 — 미지원으로 본다.
    return false;
  }
};

export const useApplePaySupport = (): boolean =>
  useSyncExternalStore(subscribe, getClientSnapshot, () => false);
