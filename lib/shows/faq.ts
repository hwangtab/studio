import { SHOW_CONTACT_PHONE } from './copy';
import { REFUND_POLICY_FOOTNOTES, refundTierLines } from './refundPolicy';

export interface ShowFaqItem {
  question: string;
  answer: string;
}

/**
 * 공연 상세 공통 FAQ — 화면(FAQSection)과 FAQPage 스키마(SEO faqItems)가 같은 배열을 읽는다.
 * 답은 코드가 실제로 하는 일에서 온다: 환불표는 lib/shows/refundPolicy.ts, 판매 마감은 lib/shows/time.ts
 * (회차 전날 24:00 KST), 티켓 전달은 lib/shows/email.ts. 공연마다 다른 것(현장 판매가·식사)은 여기 적지
 * 않고 공연 정의의 전용 칸이 말한다.
 */
export const showFaqItems = (): ShowFaqItem[] => [
  {
    question: '티켓은 어떻게 받나요?',
    answer:
      '결제가 끝나면 예매 완료 화면에 "내 티켓" 링크가 뜨고, 적어 주신 이메일로 QR 티켓을 보내 드립니다. 현장에서 QR을 보여 주시면 됩니다.',
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
];
