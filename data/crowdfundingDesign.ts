import { formatPriceAmount, FUNDING_DESIGN_PRICE, FUNDING_SUCCESS_FEE_PERCENT } from './pricing';

/**
 * 크라우드펀딩 설계 대행 LP(/ko/crowdfunding-design) 카피 — ko 전용.
 *
 * 텀블벅 등 국내 플랫폼 상품이라 다른 로케일로 열지 않는다(/funding과 같은 판단,
 * lib/koOnlyRoutes.ts). 그래서 common.json 7로케일 번역 대신 이 모듈 하나에 둔다
 * (data/buyerIntentHubs.ts가 ko 전용 허브 카피를 두는 방식과 같다).
 *
 * **여기 적는 것은 정본에 있는 사실뿐이다.** 근거:
 * - 가격·구조: data/pricing.ts FUNDING_DESIGN_PRICE·FUNDING_SUCCESS_FEE_PERCENT,
 *   docs/wiki/entities/services.md("400,000원 선불 + 성공 시 모금액의 10%" — 기준은 2026-09-25 운영자 확인)
 * - 범위(스토리텔링·리워드 설계·페이지 제작)와 실적(음반 펀딩 수십 건·누적 약 3억원):
 *   data/pricing.ts service-funding, 커밋 6766ec780a
 * - 단독 의뢰 가능·예술지원사업 상담: pages/api/llms.ts 사용 사례
 * 일정·산출물 수량 같은 약속은 정본에 없어 적지 않는다 — 생기면 정본에 먼저 적고 여기로 옮길 것.
 */

const designFee = `${formatPriceAmount(FUNDING_DESIGN_PRICE)}원`;
const successFee = `모금액의 ${FUNDING_SUCCESS_FEE_PERCENT}%`;

export const crowdfundingDesignCopy = {
  seo: {
    title: '크라우드펀딩 설계 대행 — 텀블벅 앨범 펀딩 기획·페이지 제작 | 스튜디오 놀',
    description: `텀블벅 등 음반 크라우드펀딩을 기획부터 페이지 구축까지 대행합니다. 스토리텔링·리워드 설계·페이지 제작, ${designFee} 선불 + 펀딩 성공 시 ${successFee}. 음반 펀딩 수십 건·누적 약 3억원을 진행한 프로듀서가 맡습니다.`,
    keywords: '크라우드펀딩 대행, 텀블벅 대행, 앨범 펀딩, 음반 크라우드펀딩, 펀딩 페이지 제작, 리워드 설계, 인디 앨범 제작비, 스튜디오 놀',
  },
  hero: {
    title: '크라우드펀딩 설계 대행',
    alt: '피아노 앞에서 녹음 중인 뮤지션의 뒷모습',
    line1: '앨범 제작비를 펀딩으로 모으는 일, 기획부터 페이지까지 같이 만듭니다.',
    line2: `${designFee} 선불 + 펀딩 성공 시 ${successFee} · 발매 프로젝트 없이 단독 의뢰`,
    badge: '음반 펀딩 수십 건 · 누적 약 3억원',
    cta: '카카오톡으로 펀딩 상담',
  },
  facts: {
    title: '한눈에 보기',
    serviceCol: '항목',
    valueCol: '내용',
    rows: [
      { id: 'fee', label: '기본 비용', value: `${designFee} (선불 · 부가세 별도)` },
      { id: 'success', label: '성공 수수료', value: `${successFee} (펀딩 성공 시, 캠페인 종료 후)` },
      { id: 'platform', label: '플랫폼', value: '텀블벅 등 크라우드펀딩 플랫폼' },
      { id: 'scope', label: '범위', value: '스토리텔링 · 리워드 설계 · 페이지 제작' },
      { id: 'standalone', label: '단독 의뢰', value: '가능 — 제작을 맡기지 않아도 됩니다' },
      { id: 'record', label: '진행 실적', value: '음반 펀딩 수십 건 · 누적 약 3억원' },
    ],
  },
  scope: {
    title: '맡기시면 하는 일',
    subtitle: '펀딩 페이지를 여는 데 필요한 세 가지를 기획부터 구축까지 진행합니다.',
    items: [
      {
        title: '스토리텔링',
        body: '이 음반을 왜 만드는지, 후원자가 무엇에 함께하게 되는지를 펀딩 페이지의 이야기로 정리합니다.',
      },
      {
        title: '리워드 설계',
        body: '음원·CD·굿즈 같은 리워드를 어떤 금액 구간에 어떻게 둘지 목표액에 맞춰 설계합니다.',
      },
      {
        title: '페이지 제작',
        body: '기획한 구성대로 플랫폼에 올릴 펀딩 페이지를 만듭니다.',
      },
    ],
  },
  process: {
    title: '진행 순서',
    subtitle: '상담에서 펀딩이 맞는 방법인지부터 함께 봅니다.',
    steps: [
      { title: '상담', body: '카카오톡으로 음반과 예산 상황을 알려 주세요. 펀딩이 맞는지, 예술지원사업이 더 맞는지도 같은 자리에서 봅니다.' },
      { title: '기획', body: '스토리와 리워드 구성을 정합니다.' },
      { title: '페이지 제작', body: '정한 구성대로 펀딩 페이지를 구축합니다.' },
      { title: '펀딩 종료 후', body: `펀딩이 성공했을 때만 성공 수수료(${successFee})가 발생합니다.` },
    ],
  },
  alternatives: {
    title: '상황에 따라 다른 길도 있습니다',
    items: [
      {
        title: '직접 준비해 보고 싶다면',
        body: '텀블벅·와디즈로 앨범 제작비를 모으는 과정을 정리한 가이드부터 읽어 보세요.',
        href: '/ko/stories/music-crowdfunding1',
        label: '음악 크라우드펀딩 가이드',
      },
      {
        title: '제작까지 함께 맡기고 싶다면',
        body: '기획·녹음·믹싱·마스터링·유통·홍보를 한 번에 진행하는 발매 프로젝트가 있습니다.',
        href: '/ko/release-project',
        label: '발매 프로젝트',
      },
      {
        title: '스튜디오 놀 펀딩',
        body: '스튜디오 놀이 직접 운영하는 리워드 펀딩 페이지입니다. 외부 플랫폼 캠페인을 설계하는 이 상품과는 별개입니다.',
        href: '/ko/funding',
        label: '스튜디오 놀 펀딩 보기',
      },
    ],
  },
  faq: {
    title: '자주 묻는 질문',
    subtitle: '의뢰 전에 많이 물으시는 것들입니다.',
    items: [
      {
        question: '발매 프로젝트를 맡기지 않아도 펀딩 설계만 의뢰할 수 있나요?',
        answer: '네. 녹음·믹싱을 다른 곳에서 하셨거나 아직 제작 전이어도 펀딩 설계만 따로 의뢰하실 수 있습니다.',
      },
      {
        question: '비용은 어떻게 되나요?',
        answer: `기본 비용 ${designFee}을 선불로 받고, 펀딩이 성공하면 ${successFee}를 성공 수수료로 받습니다. 부가세는 별도입니다.`,
      },
      {
        question: '펀딩이 실패하면 어떻게 되나요?',
        answer: `성공 수수료(${successFee})는 펀딩이 성공했을 때만 발생합니다. 선불 ${designFee}은 기획과 페이지 제작에 드는 비용입니다.`,
      },
      {
        question: '어떤 플랫폼에서 진행하나요?',
        answer: '텀블벅 등 크라우드펀딩 플랫폼에 올릴 캠페인을 설계합니다. 어느 플랫폼이 맞는지는 상담에서 음반과 목표에 맞춰 정합니다.',
      },
      {
        question: '스튜디오 놀 펀딩과는 무엇이 다른가요?',
        answer: '스튜디오 놀 펀딩은 스튜디오 놀이 직접 운영하는 리워드 펀딩 페이지이고, 이 상품은 텀블벅 같은 외부 플랫폼에 여는 캠페인을 설계해 드리는 일입니다.',
      },
      {
        question: '예술지원사업도 함께 상담할 수 있나요?',
        answer: '네. 예술지원사업(예술위·지역 문예진흥) 지원 방향도 같은 상담에서 함께 봅니다. 선정 여부는 심사 기관이 정하는 일이라 보장할 수 없습니다.',
      },
    ],
  },
  cta: {
    titleLine1: '제작비 때문에 멈춘 음반이 있다면',
    titleHighlight: '먼저 이야기해 주세요',
    subtitle: '음반 상태와 예산을 들으면 펀딩이 맞는 길인지부터 같이 판단합니다.',
    imageAlt: '스튜디오 놀 믹싱 콘솔',
  },
  relatedStories: {
    title: '펀딩·제작비 가이드',
    subtitle: '제작비를 마련하는 방법을 정리한 글들입니다.',
  },
} as const;
