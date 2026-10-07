/**
 * 공연 예매 화면의 언어 — 한국어와 영어 두 벌만 연다(운영자 결정 2026-10-07 "영어만").
 *
 * 다른 페이지처럼 public/locales/*\/common.json에 키를 두지 않고 여기 한 파일에 두 벌을 나란히 둔다. 공연 문구는
 * 공연 화면에서만 쓰고, 7개 로케일 파일에 넣으면 5개 로케일에 빈 키가 생긴다. 공연 **내용**(제목·소개·출연진)의
 * 영어는 공연 정의(`data/shows/<slug>.ts`의 `en`)에 있고 `lib/shows/localize.ts`가 덮어쓴다.
 *
 * 순수 모듈 — 서버·클라이언트 모두 가져다 쓴다.
 */
import { SHOW_CONTACT_PHONE } from './copy';
import { REFUND_POLICY_FOOTNOTES, REFUND_POLICY_FOOTNOTES_EN, refundTierLines, refundTierLinesEn } from './refundPolicy';

export type ShowLocale = 'ko' | 'en';
export const SHOW_LOCALES: readonly ShowLocale[] = ['ko', 'en'];

export const isShowLocale = (v: unknown): v is ShowLocale => v === 'ko' || v === 'en';
/** 페이지 params.locale → 공연이 여는 언어. 그 밖의 로케일이면 null(호출부가 /en 또는 /ko로 보낸다). */
export const toShowLocale = (v: unknown): ShowLocale | null => (isShowLocale(v) ? v : null);
/** 공연을 열지 않는 로케일(zh·es…)에서 들어왔을 때 보낼 곳 — 한국어 화면이 아니면 영어가 더 읽힌다. */
export const fallbackShowLocale = (v: unknown): ShowLocale => (v === 'ko' ? 'ko' : 'en');

export const SHOW_CONTACT_PHONE_INTL = '+82 10-4255-7893';

/** 금액 — ko `25,000원`, en `₩25,000`. */
export const formatShowWon = (n: number, locale: ShowLocale = 'ko'): string =>
  locale === 'en' ? `₩${n.toLocaleString('en-US')}` : `${n.toLocaleString('ko-KR')}원`;

type SaleStateKey = 'open' | 'sold_out' | 'closed' | 'ended' | 'cancelled';
const SALE_STATE: Record<'ko' | 'en', Record<SaleStateKey, string>> = {
  ko: { open: '예매 중', sold_out: '매진', closed: '예매 마감', ended: '종료', cancelled: '취소됨' },
  en: { open: 'On sale', sold_out: 'Sold out', closed: 'Sales closed', ended: 'Ended', cancelled: 'Cancelled' },
};

/** 취소환불표 한 줄씩 — ko는 refundPolicy.ts가 표에서 만든다. en은 같은 표를 영어로. */
export const refundLines = (locale: ShowLocale): string[] =>
  locale === 'en' ? refundTierLinesEn() : refundTierLines();
export const refundFootnotes = (locale: ShowLocale): readonly string[] =>
  locale === 'en' ? REFUND_POLICY_FOOTNOTES_EN : REFUND_POLICY_FOOTNOTES;

const ko = {
  saleState: SALE_STATE.ko,
  presentedBy: (name: string) => `${name} 주최`,
  moreShowtimes: (n: number) => `외 ${n}회`,
  ctaBook: (price: string | null) => `티켓 예매하기${price ? ` · ${price}` : ''}`,
  ctaCancelled: '취소된 공연입니다',
  ctaUnavailable: '지금은 예매할 수 없습니다',
  cancelledNotice: `이 공연은 취소되었습니다. 결제하신 분께는 별도로 환불을 안내해 드립니다. 문의 ${SHOW_CONTACT_PHONE}`,
  sections: {
    about: { eyebrow: '소개', title: '공연 소개' },
    lineup: { eyebrow: '출연', title: '출연' },
    venue: { eyebrow: '장소', title: '오시는 길' },
    tickets: { eyebrow: '예매', title: '티켓 예매' },
  },
  ticketsSubtitle: '온라인 예매는 공연 전날 자정에 마감됩니다. 티켓(QR)은 메일로 보내 드립니다.',
  contactLine: `문의 ${SHOW_CONTACT_PHONE}`,
  faqTitle: '자주 묻는 질문',
  faqSubtitle: '티켓 전달·입장·취소에 관해 자주 묻는 질문입니다.',
  facts: {
    when: '일시',
    where: '장소',
    tickets: '티켓',
    admission: '관람',
    admissionLine: (age: string, minutes: number) => `${age} · 약 ${minutes}분 · 비지정석(선착순 입장)`,
    salesClose: '온라인 예매는 공연 전날 자정에 마감됩니다.',
  },
  posterAlt: (title: string) => `${title} 포스터`,
  posterOpen: (title: string) => `${title} 포스터 원본 크게 보기`,
  performerPhotoAlt: (name: string) => `${name} 프로필 사진`,
  mapTitle: (venue: string) => `${venue} 위치 지도`,
  directionsIn: (provider: string) => `${provider}에서 길찾기`,
  list: {
    seoTitle: '공연 티켓 예매 | 스튜디오 놀',
    seoDescription: '스튜디오 놀이 여는 공연의 일정과 티켓 예매 안내. 비지정석, 사전 예매는 온라인에서 받습니다.',
    heroTitle: '공연',
    heroSubtitle: '스튜디오 놀이 여는 공연입니다. 사전 예매는 온라인에서 받고, 티켓(QR)은 메일로 보내 드립니다.',
    upcomingEyebrow: '예매',
    upcoming: '다가오는 공연',
    empty: '지금 예매할 수 있는 공연이 없습니다',
    emptyHint: `새 공연은 SNS와 스토리에서 먼저 알립니다. 문의 ${SHOW_CONTACT_PHONE}`,
    pastEyebrow: '아카이브',
    past: '지난 공연',
  },
  breadcrumbHome: '홈',
  breadcrumbShows: '공연',
  detailSeoTitle: (title: string) => `${title} 티켓 예매 | 스튜디오 놀`,
  form: {
    ariaLabel: '티켓 예매',
    cancelled: '이 공연은 취소되었습니다. 문의는 아래 연락처로 부탁드립니다.',
    comingSoon: '예매 일정이 곧 공개됩니다.',
    showtime: '회차',
    noOpenShowtime: '지금 예매할 수 있는 회차가 없습니다.',
    remaining: (n: number) => `잔여 ${n}석`,
    available: '예매 가능',
    soldOut: '매진',
    ticket: '티켓',
    quantity: '매수',
    quantityHint: (max: number) => `1회 최대 ${max}매`,
    quantityOption: (n: number) => `${n}매`,
    name: '이름',
    phone: '휴대폰 번호',
    phonePlaceholder: '010-0000-0000',
    phoneHint: undefined as string | undefined,
    email: '이메일',
    emailHint: '티켓(QR)을 이 주소로 보내 드립니다.',
    payMethod: '결제 수단',
    confirmLabel: '티켓이 발권',
    retry: '다시 시도',
    agreeLead: (bank: boolean) => `${bank ? '계좌 안내 받기' : '결제하기'}를 누르면 취소·환불 규정과 `,
    privacy: '개인정보 처리방침',
    agreeTail: '에 동의하는 것으로 봅니다. ',
    holdBank: '좌석은 입금을 확인할 때까지 잡아 두고, 확인되면 티켓(QR)을 메일로 보내 드립니다.',
    holdToss: (minutes: number) => `좌석은 결제창을 여는 동안 ${minutes}분간 보류됩니다.`,
    refundPolicy: '취소·환불 규정 보기',
    processing: '처리 중…',
    submit: (total: string, bank: boolean) => `${total} · ${bank ? '계좌 안내 받기' : '결제하기'}`,
    orderName: (title: string, when: string, type: string, qty: number) => `${title} ${when} ${type} ${qty}매`,
    errTerms: '결제수단 아래 [필수] 결제 서비스 이용 약관에도 동의해 주세요.',
    errCreate: '주문을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
    errBank: '신청하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    errNetworkBank: '네트워크 오류로 신청하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    errNeedCard: '카드 결제는 카드사를 먼저 골라 주세요. 결제 방법 아래에서 카드사를 선택한 뒤 다시 눌러 주세요.',
    errClosed: '결제창이 닫혔습니다. 좌석은 잠시 보류되어 있으니 같은 버튼으로 다시 시도할 수 있습니다.',
  },
};

export type ShowCopy = typeof ko;

const en: ShowCopy = {
  saleState: SALE_STATE.en,
  presentedBy: (name: string) => `Presented by ${name}`,
  moreShowtimes: (n: number) => `+${n} more`,
  ctaBook: (price: string | null) => `Book tickets${price ? ` · ${price}` : ''}`,
  ctaCancelled: 'This show has been cancelled',
  ctaUnavailable: 'Tickets are not on sale right now',
  cancelledNotice: `This show has been cancelled. Everyone who paid will be contacted about a refund. Contact: ${SHOW_CONTACT_PHONE_INTL}`,
  sections: {
    about: { eyebrow: 'About', title: 'About the show' },
    lineup: { eyebrow: 'Lineup', title: 'Lineup' },
    venue: { eyebrow: 'Venue', title: 'Getting there' },
    tickets: { eyebrow: 'Tickets', title: 'Book tickets' },
  },
  ticketsSubtitle: 'Online sales close at midnight (KST) the day before the show. Your ticket (QR code) is sent by email.',
  contactLine: `Contact: ${SHOW_CONTACT_PHONE_INTL} · hello@studionol.co.kr`,
  faqTitle: 'FAQ',
  faqSubtitle: 'Common questions about tickets, entry and refunds.',
  facts: {
    when: 'Date',
    where: 'Venue',
    tickets: 'Tickets',
    admission: 'Admission',
    admissionLine: (age: string, minutes: number) => `${age} · approx. ${minutes} min · general admission (first come, first served)`,
    salesClose: 'Online sales close at midnight (KST) the day before the show.',
  },
  posterAlt: (title: string) => `${title} poster`,
  posterOpen: (title: string) => `Open the full-size ${title} poster`,
  performerPhotoAlt: (name: string) => `Photo of ${name}`,
  mapTitle: (venue: string) => `Map of ${venue}`,
  directionsIn: (provider: string) => `Directions in ${provider}`,
  list: {
    seoTitle: 'Concert tickets | Studio NOL',
    seoDescription: 'Upcoming shows hosted by Studio NOL in Seoul — dates and online ticket booking. General admission; tickets are sent by email.',
    heroTitle: 'Shows',
    heroSubtitle: 'Shows hosted by Studio NOL. Book online in advance and we will email your ticket (QR code).',
    upcomingEyebrow: 'Tickets',
    upcoming: 'Upcoming shows',
    empty: 'No shows are on sale right now',
    emptyHint: `New shows are announced on our social channels first. Contact: ${SHOW_CONTACT_PHONE_INTL}`,
    pastEyebrow: 'Archive',
    past: 'Past shows',
  },
  breadcrumbHome: 'Home',
  breadcrumbShows: 'Shows',
  detailSeoTitle: (title: string) => `${title} — Tickets | Studio NOL`,
  form: {
    ariaLabel: 'Book tickets',
    cancelled: 'This show has been cancelled. Please use the contact details below if you have questions.',
    comingSoon: 'Showtimes will be announced soon.',
    showtime: 'Showtime',
    noOpenShowtime: 'No showtimes are on sale right now.',
    remaining: (n: number) => `${n} left`,
    available: 'Available',
    soldOut: 'Sold out',
    ticket: 'Ticket',
    quantity: 'Quantity',
    quantityHint: (max: number) => `Up to ${max} per order`,
    quantityOption: (n: number) => (n === 1 ? '1 ticket' : `${n} tickets`),
    name: 'Name',
    phone: 'Phone number',
    phonePlaceholder: '+82 10-0000-0000',
    phoneHint: 'A Korean mobile number or an international number with the country code (e.g. +1 …).',
    email: 'Email',
    emailHint: 'We will send your ticket (QR code) to this address.',
    payMethod: 'Payment method',
    confirmLabel: 'your ticket is issued',
    retry: 'Try again',
    agreeLead: (bank: boolean) => `By pressing “${bank ? 'Get bank details' : 'Pay'}”, you agree to the refund policy and our `,
    privacy: 'privacy policy (Korean)',
    agreeTail: '. ',
    holdBank: 'Your seats are held until we confirm your transfer; we then email your ticket (QR code).',
    holdToss: (minutes: number) => `Your seats are held for ${minutes} minutes while the payment window is open.`,
    refundPolicy: 'Refund policy',
    processing: 'Processing…',
    submit: (total: string, bank: boolean) => `${total} · ${bank ? 'Get bank details' : 'Pay'}`,
    orderName: (title: string, when: string, type: string, qty: number) => `${title} ${when} ${type} x${qty}`,
    errTerms: 'Please also agree to the [Required] payment service terms below the payment methods.',
    errCreate: 'We could not create your order. Please try again in a moment.',
    errBank: 'We could not register your request. Please try again in a moment.',
    errNetworkBank: 'A network error stopped your request. Please try again in a moment.',
    errNeedCard: 'For card payment, please choose your card company first, then press the button again.',
    errClosed: 'The payment window was closed. Your seats are held for a few minutes, so you can try again with the same button.',
  },
};

export const SHOW_COPY: Record<ShowLocale, ShowCopy> = { ko, en };
export const showCopy = (locale: ShowLocale): ShowCopy => SHOW_COPY[locale];

/** 공연 경로 — 언어 접두어를 한 곳에서 붙인다. */
export const showPath = (locale: ShowLocale, rest = ''): string => `/${locale}/shows${rest}`;
