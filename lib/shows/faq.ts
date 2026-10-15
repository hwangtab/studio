import { SHOW_CONTACT_PHONE } from './copy';
import { SHOW_CONTACT_PHONE_INTL, type ShowLocale } from './i18n';
import { REFUND_POLICY_FOOTNOTES, REFUND_POLICY_FOOTNOTES_EN, refundTierLines, refundTierLinesEn } from './refundPolicy';

export interface ShowFaqItem {
  question: string;
  answer: string;
}

/**
 * 공연 상세 공통 FAQ — 화면(FAQSection)과 FAQPage 스키마(SEO faqItems)가 같은 배열을 읽는다.
 * 답은 코드가 실제로 하는 일에서 온다: 환불표는 lib/shows/refundPolicy.ts, 판매 마감은 lib/shows/time.ts
 * (회차 전날 24:00 KST), 티켓 전달은 lib/shows/email.ts. 공연마다 다른 것(현장 판매가·입장 시각)은 여기 적지
 * 않고 공연 정의의 전용 칸이 말한다.
 */
export const showFaqItems = (locale: ShowLocale = 'ko'): ShowFaqItem[] => (locale === 'en' ? FAQ_EN() : [
  {
    question: '티켓은 어떻게 받나요?',
    answer:
      '결제가 끝나면 예매 완료 화면에 "내 티켓" 링크가 뜨고, 적어 주신 이메일로 QR 티켓을 보내 드립니다. 현장에서 QR을 보여 주시면 됩니다.',
  },
  {
    question: '계좌로 입금해도 되나요?',
    answer:
      '네. 결제 수단에서 "계좌로 직접 입금"을 고르시면 입금하실 계좌를 바로 알려 드리고, 입금이 확인될 때까지 좌석을 잡아 둡니다. ' +
      '입금이 확인되면 QR 티켓을 메일로 보내 드립니다. 보내는 분 이름은 예매하신 분 성함으로 해 주세요.',
  },
  {
    question: '좌석은 어떻게 정해지나요?',
    answer: '비지정석 선착순 입장입니다. 현장에서 QR을 확인하면 입장 번호를 안내해 드리고, 그 순서대로 들어갑니다.',
  },
  {
    question: '취소·환불은 어떻게 하나요?',
    answer: [
      '내 티켓 페이지에서 티켓별로 직접 환불을 신청할 수 있습니다. 환불 금액은 공연까지 남은 날짜에 따릅니다.',
      ...refundTierLines(),
      ...REFUND_POLICY_FOOTNOTES,
    ].join('\n'),
  },
  {
    question: '온라인 예매는 언제 마감되나요?',
    answer: '공연 전날 자정에 마감됩니다. 현장 판매 여부와 가격은 각 공연 안내를 따릅니다.',
  },
  {
    question: '티켓 메일을 못 받았어요.',
    answer: `예매 완료 화면의 "내 티켓" 주소로 언제든 다시 열 수 있습니다. 주소를 잃어버리셨으면 주문번호와 함께 ${SHOW_CONTACT_PHONE}로 연락해 주세요.`,
  },
]);

/** 영어판 — 위 한국어 답과 같은 사실을 같은 순서로. 한쪽을 고치면 다른 쪽도 고친다. */
const FAQ_EN = (): ShowFaqItem[] => [
  {
    question: 'How do I get my ticket?',
    answer:
      'When payment is complete, the confirmation page shows a “My tickets” link and we email your QR ticket to the address you entered. Just show the QR code at the door.',
  },
  {
    question: 'Can I pay by bank transfer?',
    answer:
      'Yes. Choose “Bank transfer” as the payment method and we will show you the account right away; your seats are held until the transfer is confirmed. ' +
      'Once it is confirmed, we email your QR ticket. Please send the transfer under the name you booked with.',
  },
  {
    question: 'How are seats assigned?',
    answer: 'General admission, first come, first served. When we scan your QR code at the door, we give you an entry number and let people in in that order.',
  },
  {
    question: 'How do I cancel or get a refund?',
    answer: [
      'You can request a refund for each ticket yourself on the “My tickets” page. The refund amount depends on how many days are left before the show.',
      ...refundTierLinesEn(),
      ...REFUND_POLICY_FOOTNOTES_EN,
    ].join('\n'),
  },
  {
    question: 'When do online sales close?',
    answer: 'At midnight (KST) the day before the show. Whether tickets are sold at the door, and at what price, is noted on each show page.',
  },
  {
    question: 'I did not receive the ticket email.',
    answer: `You can open your ticket any time from the “My tickets” link on the confirmation page. If you lost the link, contact us at ${SHOW_CONTACT_PHONE_INTL} or hello@studionol.co.kr with your order number.`,
  },
];
