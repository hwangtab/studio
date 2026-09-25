import '@testing-library/jest-dom';

/**
 * jsdom에는 `fetch`가 없다. 브라우저에는 항상 있으므로 컴포넌트가 이 함수의 존재를
 * 확인하고 쓰게 만들 이유가 없다 — 대신 시험 환경에서만 없는 것을 여기서 채운다.
 *
 * 응답은 비어 있다. 실제 응답을 보는 테스트는 각자 `global.fetch`를 자기 값으로
 * 덮어쓴다. 이 기본값이 하는 일은 "부르기만 하는" 호출(예: AdminShell이 마운트 때
 * 묻는 현재 관리자)이 테스트를 깨뜨리지 않게 하는 것뿐이다.
 */
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
}
