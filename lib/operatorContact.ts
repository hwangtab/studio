/**
 * 운영자의 **실제 받은편지함**. 운영자 알림은 여기로 **바로** 보낸다.
 *
 * 같은 주소가 라우트마다 리터럴로 흩어져 있었다(inbound/resend, contact/send-email,
 * cron/*, lib/contracts/email). 저장소가 공개돼 있으면 그만큼 스팸 수집 대상이 되고,
 * 주소를 바꿀 때 한 곳을 빠뜨리면 그 경로의 알림만 조용히 사라진다.
 *
 * **hello@로 보내지 않는다**(2026-10-03 운영자 결정, #433 되돌림). hello@는 사서함이 아니라 Resend 수신이고
 * pages/api/inbound/resend.ts가 이 주소로 다시 보낸다. 운영자 알림을 hello@로 보냈더니
 * ① 재발송이 답장 주소를 원 메일의 From(noreply@)으로 덮어 **문의 폼 답장이 고객에게 가지 않았고**,
 * ② 모든 알림이 수신 웹훅이라는 한 경로에 걸려, 웹훅이 죽으면 그 사실을 알리는 메일까지 함께 사라졌다.
 * 어느 쪽이든 도착하는 곳은 같은 받은편지함이므로 중간 단계를 두지 않는다.
 *
 * `CONTRACT_OPERATOR_EMAIL`은 lib/contracts/email.ts가 이미 쓰던 이름이라 유지한다.
 * **hello@로 설정하지 말 것** — 수신 웹훅의 전달 대상이 자기 자신이 되어 루프 차단에 걸려 모두 버려진다.
 */
export const OPERATOR_INBOX = process.env.CONTRACT_OPERATOR_EMAIL || 'hwangtab@gmail.com';

/** 운영자 알림 수신 주소. 실제 받은편지함과 같다(위 주석). 호출부가 많아 이름을 유지한다. */
export const OPERATOR_EMAIL = OPERATOR_INBOX;

/**
 * 고객에게 나가는 메일의 회신 주소이자, 고객 문서에 인쇄하는 접수 주소.
 *
 * `OPERATOR_EMAIL`(운영자 개인 받은편지함)과 갈라 두는 이유: 이 주소는 고객이 **본다**.
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
