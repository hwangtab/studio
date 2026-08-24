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
