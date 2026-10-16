/**
 * 소프트웨어 판매 운영 상수. 화면·서버가 이 값만 읽는다.
 *
 * **이 모듈은 아무것도 import하지 않는다** — 상품 화면(클라이언트 번들)과 서버가 같은 값을 쓴다.
 */

/**
 * 판매 개시. false면 목록·상세는 `noindex`이고 "판매 준비 중"을 보이며, 메뉴·사이트맵에 넣지 않는다.
 * (결제는 2단계 — 이 값이 true가 되기 전에 결제 흐름·처리방침·약관이 먼저 있어야 한다.)
 */
export const SOFTWARE_SALES_OPEN = false;

/** 체험 기간(일) 기본값. */
export const SOFTWARE_DEFAULT_TRIAL_DAYS = 30;

/** 라이선스 한 개당 동시 활성 기기 수 기본값. */
export const SOFTWARE_DEFAULT_MAX_ACTIVATIONS = 3;

/** 페이지 이름과 겹쳐 slug로 쓸 수 없는 낱말. */
export const SOFTWARE_RESERVED_SLUGS: readonly string[] = ['manage', 'success', 'fail', 'find'];

/**
 * 고객 셀프 환불 기간(일, 결제 승인 시각부터). 라이선스를 **한 번도 활성화하지 않았을 때만** — 활성화가 디지털콘텐츠
 * "제공 개시"다(전자상거래법 제17조 제2항 제5호, 계획서 §4). 법정 청약철회 기간 7일에 맞춘다.
 */
export const SOFTWARE_SELF_CANCEL_DAYS = 7;

/**
 * 고객 쪽(플러그인 "이 기기에서 해제"·구매 내역 화면) 기기 해제 한도 — 라이선스당 30일에 이 횟수까지. 운영자 해제는 한도가 없다.
 * 서명 파일은 오프라인이라 해제한 기기의 파일도 계속 돈다. 한도가 없으면 활성화→해제를 되풀이해 기기 수 한도를 무력화할 수 있다
 * (2026-10-14 감사 재현: 한도 2인 키로 파일 10개). 정상 사용(컴퓨터 교체·재설치)은 한 달에 몇 번이면 충분하다.
 */
export const SOFTWARE_DEACTIVATIONS_PER_30_DAYS = 5;

/** 헤더·푸터 메뉴 이름(ko·en 화면만 있다). 판매를 열 때(SOFTWARE_SALES_OPEN)만 메뉴에 나온다. */
export const SOFTWARE_NAV_LABEL: Readonly<Record<'ko' | 'en', string>> = { ko: '소프트웨어', en: 'Software' };
