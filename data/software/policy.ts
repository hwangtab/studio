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
