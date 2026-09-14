/**
 * 운영자에게 닿는 주소의 단일 소스.
 *
 * 같은 주소가 라우트마다 리터럴로 흩어져 있었다(inbound/resend, contact/send-email,
 * cron/*, lib/contracts/email). 저장소가 공개돼 있으면 그만큼 스팸 수집 대상이 되고,
 * 주소를 바꿀 때 한 곳을 빠뜨리면 그 경로의 알림만 조용히 사라진다.
 *
 * 기본값은 기존 동작 그대로다 — 환경변수를 설정하지 않아도 지금과 똑같이 동작한다.
 * `CONTRACT_OPERATOR_EMAIL`은 lib/contracts/email.ts가 이미 쓰던 이름이라 유지한다.
 */
export const OPERATOR_EMAIL = process.env.CONTRACT_OPERATOR_EMAIL || 'hwangtab@gmail.com';

/**
 * 고객에게 나가는 메일의 회신 주소이자, 고객 문서에 인쇄하는 접수 주소.
 *
 * `OPERATOR_EMAIL`(기본 개인 Gmail)과 갈라 두는 이유: 이 주소는 고객이 **본다**.
 * pages/api/inbound/resend.ts의 INBOUND_ALIAS로 수신 웹훅이 첨부까지 운영자에게
 * 포워딩하므로 도달은 같고, 사이트 도메인 주소라 신뢰도가 높으며 운영자 개인 주소를
 * 발송 메일에 노출하지 않는다.
 *
 * 여기 두는 이유: 예약(lib/booking/email.ts)과 펀딩(lib/funding/email.ts)이 각자
 * 정의하면 한쪽만 바뀐다. 실제로 펀딩 쪽은 개인 주소를 청약철회 접수 주소로 인쇄하고
 * 있었고, 같은 사이트의 펀딩 약관 제16조는 hello@를 문의처로 고지하고 있었다 —
 * 계약 서면 안의 접수 주소가 약관과 다른 상태였다.
 *
 * 주소를 바꾼다면 INBOUND_ALIAS(그 라우트의 지역 상수)도 함께 고쳐야 한다.
 */
export const CUSTOMER_REPLY_TO = 'hello@studionol.co.kr';
