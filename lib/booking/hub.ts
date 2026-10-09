import { formatPriceAmount, PRACTICE_ROOM_HOURLY_PRICE_INCL } from '../../data/pricing';
import { MASTERING_PACKAGE_MIN_SONGS, MIXING_PRODUCTS, mixingUnitAmount } from './mixing-products';
import { getProduct } from './products';

/**
 * /ko/booking 통합 랜딩이 보여 주는 예약·주문 입구 목록.
 *
 * **가격·이름·시간은 전부 상품 정본에서 읽는다** — 세션 상품은 lib/booking/products.ts,
 * 믹싱·마스터링은 lib/booking/mixing-products.ts. 이 파일이 따로 가격을 들면 위저드가
 * 청구하는 금액과 랜딩이 보여 주는 금액이 갈라진다. lib/booking/hub.test.ts가 모든 링크가
 * 실제 상품을 가리키는지 고정한다.
 */

export interface BookingHubEntry {
  /** 상품 id — ?product=로 위저드에 미리 선택돼 넘어간다. */
  productId: string;
  name: string;
  /** "350,000원" — 부가세 표기는 그룹의 priceNote가 말한다. */
  price: string;
  /** "/ 3시간" · "/ 시간" · "/ 곡" */
  unit: string;
  /** 한 줄 설명(조건). */
  detail: string;
  href: string;
}

export interface BookingHubGroup {
  id: string;
  title: string;
  description: string;
  /** 이 그룹 금액의 부가세 표기. */
  priceNote: string;
  /** 그룹 전체의 위저드 주소(상품 선택 없이 들어갈 때). */
  href: string;
  entries: BookingHubEntry[];
}

const won = (value: number) => `${formatPriceAmount(value)}원`;

const sessionEntry = (productId: string, detail: string, nameOverride?: string): BookingHubEntry => {
  const product = getProduct(productId);
  if (!product) throw new Error(`booking hub: 알 수 없는 세션 상품 ${productId}`);
  const isPackage = product.kind === 'package';
  return {
    productId,
    name: nameOverride ?? product.nameKo,
    price: won(product.unitAmount),
    unit: isPackage ? `/ ${product.sessionHours}시간` : '/ 시간',
    detail,
    href: `/ko/booking/${product.service}?product=${productId}`,
  };
};

const mixingEntry = (productId: string, detail: string): BookingHubEntry => {
  const product = MIXING_PRODUCTS.find((p) => p.id === productId);
  if (!product) throw new Error(`booking hub: 알 수 없는 믹싱 상품 ${productId}`);
  return {
    productId,
    name: product.nameKo,
    price: won(product.unitAmount),
    unit: '/ 곡',
    detail: product.combinedOf
      ? `${detail} · ${MASTERING_PACKAGE_MIN_SONGS}곡부터 곡당 ${won(mixingUnitAmount(product, MASTERING_PACKAGE_MIN_SONGS))}`
      : detail,
    href: `/ko/booking/mixing-mastering?product=${productId}`,
  };
};

export const buildBookingHub = (): BookingHubGroup[] => {
  const practiceRoom = getProduct('practice-room-hourly');
  if (!practiceRoom) throw new Error('booking hub: 연습실 시간제 상품이 없다');

  return [
    {
      id: 'recording',
      title: '보컬 녹음',
      description: '전담 엔지니어와 함께 녹음해요. 날짜와 시간을 고르고 바로 결제하면 확정 메일이 가요.',
      priceNote: '부가세 별도',
      href: '/ko/booking/recording',
      entries: [
        sessionEntry('recording-pro', '1곡 · 전담 엔지니어 포함'),
        sessionEntry('recording-hourly', `최소 ${getProduct('recording-hourly')?.minHours}시간부터 · 보정·악기 추가에도`, '시간당 녹음'),
        sessionEntry('recording-daylock-4h', '긴 작업을 묶은 고정 시간 패키지'),
        sessionEntry('recording-daylock-8h', '긴 작업을 묶은 고정 시간 패키지'),
      ],
    },
    {
      id: 'voice-acting',
      title: '성우·내레이션 녹음',
      description: '유튜브 내레이션·오디오북·광고 녹음.',
      priceNote: '부가세 별도',
      href: '/ko/booking/voice-acting',
      entries: [sessionEntry('voice-acting-hourly', `최소 ${getProduct('voice-acting-hourly')?.minHours}시간부터`)],
    },
    {
      id: 'wedding-song',
      title: '축가 녹음',
      description: '녹음과 보컬 보정, 믹싱·마스터링까지 한 번에.',
      priceNote: '부가세 별도',
      href: '/ko/booking/wedding-song',
      entries: [sessionEntry('wedding-song', '녹음 + 보컬 튜닝 + 믹싱·마스터링', '축가 완성 패키지')],
    },
    {
      id: 'cover-video',
      title: '커버 영상',
      description: '촬영·녹음·믹싱을 한 세션에. 4K 영상과 음원을 함께 드려요.',
      priceNote: '부가세 별도',
      href: '/ko/booking/cover-video',
      entries: [sessionEntry('cover-video', '촬영 + 보컬 녹음 + 믹싱 + 4K 편집', '커버 영상 올인원')],
    },
    {
      id: 'practice-room',
      title: '음악연습실 시간제',
      description: '24시간 방음 개인실을 1시간부터 쓸 수 있어요. 예약 후 확정 메일로 입장 안내를 받아요.',
      priceNote: '부가세 포함',
      href: '/ko/booking/practice-room',
      entries: [
        {
          productId: practiceRoom.id,
          name: practiceRoom.nameKo,
          price: won(PRACTICE_ROOM_HOURLY_PRICE_INCL),
          unit: '/ 시간',
          detail: `${practiceRoom.minHours}~${practiceRoom.maxHours}시간 · 24시간 예약`,
          href: `/ko/booking/practice-room?product=${practiceRoom.id}`,
        },
      ],
    },
    {
      id: 'mixing-mastering',
      title: '믹싱·마스터링 의뢰',
      description: '날짜 예약이 아니라 파일 주문이에요. 믹싱과 마스터링을 한 번에 맡기려면 위의 \"믹싱+마스터링\"을 고르세요. 결제 후 확인 메일에 파일 링크로 회신하면 작업을 시작해요. 방문은 필요 없어요.',
      priceNote: '부가세 별도 · 곡당',
      href: '/ko/booking/mixing-mastering',
      entries: [
        // 믹싱과 마스터링을 한 번에 결제 — 가격은 두 상품의 합산 그대로(번들 할인 없음).
        mixingEntry('mixing-mastering-level1', '믹싱 2회·마스터링 1회 수정 포함'),
        mixingEntry('mixing-mastering-level2', '믹싱 2회·마스터링 1회 수정 포함'),
        mixingEntry('mixing-mastering-level3', '믹싱 2회·마스터링 1회 수정 포함'),
        mixingEntry('mixing-level1', '수정 2회 포함'),
        mixingEntry('mixing-level2', '수정 2회 포함'),
        mixingEntry('mixing-level3', '수정 2회 포함'),
        mixingEntry('mastering-single', '수정 1회 포함'),
        mixingEntry('mastering-package', '4곡 이상 함께 맡길 때'),
      ],
    },
  ];
};

/** 온라인 결제가 없는 상품 — 문의로 진행한다. 랜딩 하단에 "그 밖의 의뢰"로 링크만 건다. */
export const BOOKING_HUB_INQUIRY_LINKS: readonly { label: string; description: string; href: string }[] = [
  { label: '음악연습실 월 입주', description: '월 단위 입주는 상담 후 계약해요.', href: '/ko/practice-room' },
  { label: '프로듀싱 레슨', description: '미디·작곡·믹싱 1:1 레슨. 첫 상담은 무료예요.', href: '/ko/lesson' },
  { label: '발매 프로젝트', description: '기획부터 유통·홍보까지. 싱글·EP·정규.', href: '/ko/release-project' },
  { label: '음원 발매 홍보', description: '이미 발매한 음원의 보도자료·매체 발송.', href: '/ko/music-promotion' },
  { label: '크라우드펀딩 설계 대행', description: '텀블벅 등 펀딩 페이지 기획·제작.', href: '/ko/crowdfunding-design' },
];
