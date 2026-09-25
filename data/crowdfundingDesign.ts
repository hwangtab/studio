import { formatPriceAmount, FUNDING_DESIGN_PRICE, FUNDING_PAYMENT_FEE_PERCENT, FUNDING_PLATFORM_FEE_PERCENT } from './pricing';
import { CASES_CHECKED_ON, CASES_SUMMARY } from './crowdfundingCases';

/**
 * 크라우드펀딩 설계 대행 LP(/ko/crowdfunding-design) 카피 — ko 전용.
 *
 * 스튜디오 놀 펀딩(/funding, ko 전용)에 여는 캠페인을 설계하는 상품이라 다른 로케일로 열지 않는다(
 * lib/koOnlyRoutes.ts). 그래서 common.json 7로케일 번역 대신 이 모듈 하나에 둔다
 * (data/buyerIntentHubs.ts가 ko 전용 허브 카피를 두는 방식과 같다).
 *
 * **여기 적는 것은 정본에 있는 사실뿐이다.** 근거:
 * - 가격·구조: data/pricing.ts FUNDING_DESIGN_PRICE(설계비, 부가세 별도) + 모금액에서 떼는
 *   FUNDING_PLATFORM_FEE_PERCENT·FUNDING_PAYMENT_FEE_PERCENT(부가세 포함). 성공 수수료 없음,
 *   펀딩은 스튜디오 놀 펀딩에서만 연다(2026-09-25 운영자 결정). 옛 구조(선불 설계비 + 성공 수수료,
 *   텀블벅 등 외부 플랫폼)는 폐지 — 아래 "진행한 펀딩" 표의 텀블벅 건은 그 시절의 실적이다.
 * - 범위(스토리텔링·리워드 설계·페이지 제작)와 실적(음반 펀딩 수십 건·누적 약 3억원):
 *   data/pricing.ts service-funding, 커밋 6766ec780a
 * - 단독 의뢰 가능·예술지원사업 상담: pages/api/llms.ts 사용 사례
 * - 공개로 확인 가능한 개별 펀딩: data/crowdfundingCases.ts(플랫폼에서 직접 확인한 수치)
 * 일정·산출물 수량 같은 약속은 정본에 없어 적지 않는다 — 생기면 정본에 먼저 적고 여기로 옮길 것.
 */

const designFee = `${formatPriceAmount(FUNDING_DESIGN_PRICE)}원`;
const fundingFees = `플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}% · 결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%(부가세 포함)`;
const casesLine = `성공 ${CASES_SUMMARY.succeededCount}건 · 누적 ${formatPriceAmount(CASES_SUMMARY.succeededRaised)}원 · 후원자 ${formatPriceAmount(CASES_SUMMARY.succeededBackers)}명`;

export const crowdfundingDesignCopy = {
  seo: {
    title: '크라우드펀딩 설계 대행 — 앨범 펀딩 기획·리워드·페이지 제작 | 스튜디오 놀',
    description: `음반 크라우드펀딩을 기획부터 페이지 구축까지 대행하고, 스튜디오 놀 펀딩에 엽니다. 설계비 ${designFee}(부가세 별도), 성공 수수료 없음 — 모금액에서는 ${fundingFees}만 뗍니다. 음반 펀딩 수십 건·누적 약 3억원을 진행한 프로듀서가 맡습니다.`,
    keywords: '크라우드펀딩 대행, 앨범 펀딩, 음반 크라우드펀딩, 펀딩 페이지 제작, 리워드 설계, 인디 앨범 제작비, 음반 제작비 마련, 스튜디오 놀 펀딩',
  },
  hero: {
    title: '크라우드펀딩 설계 대행',
    alt: '피아노 앞에서 녹음 중인 뮤지션의 뒷모습',
    line1: '앨범 제작비를 펀딩으로 모으는 일, 기획부터 페이지까지 같이 만듭니다.',
    line2: `설계비 ${designFee} · 성공 수수료 없음 · 스튜디오 놀 펀딩에서 엽니다`,
    badge: '음반 펀딩 수십 건 · 누적 약 3억원',
    cta: '카카오톡으로 펀딩 상담',
  },
  facts: {
    title: '한눈에 보기',
    serviceCol: '항목',
    valueCol: '내용',
    rows: [
      { id: 'fee', label: '설계비', value: `${designFee} (부가세 별도)` },
      { id: 'success', label: '성공 수수료', value: '없음' },
      { id: 'funding-fees', label: '모금액에서 떼는 것', value: fundingFees },
      { id: 'platform', label: '플랫폼', value: '스튜디오 놀 펀딩(이 사이트)' },
      { id: 'scope', label: '범위', value: '스토리텔링 · 리워드 설계 · 페이지 제작' },
      { id: 'standalone', label: '단독 의뢰', value: '가능 — 제작을 맡기지 않아도 됩니다. 제작·홍보·유통까지 이어 가려면 발매 프로젝트로' },
      { id: 'record', label: '진행 실적', value: '음반 펀딩 수십 건 · 누적 약 3억원' },
      { id: 'verifiable', label: '공개로 확인 가능', value: `${casesLine} (텀블벅·씨앗페)` },
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
        body: '기획한 구성대로 스튜디오 놀 펀딩에 올릴 페이지를 만듭니다.',
      },
    ],
  },
  cases: {
    title: '진행한 펀딩',
    subtitle: `운영자가 기획·운영한 펀딩 가운데 텀블벅·씨앗페에서 누구나 확인할 수 있는 것만 실었습니다 — ${casesLine}. 이 밖에도 더 있습니다.`,
    caption: '운영자가 기획·운영한 크라우드펀딩',
    columns: { title: '프로젝트', kind: '분야', raised: '모금액', percent: '달성률', backers: '후원자', period: '마감' },
    ongoing: '진행 중',
    checkedOn: `${CASES_CHECKED_ON} 확인`,
  },
  process: {
    title: '진행 순서',
    subtitle: '상담에서 펀딩이 맞는 방법인지부터 함께 봅니다.',
    steps: [
      { title: '상담', body: '카카오톡으로 음반과 예산 상황을 알려 주세요. 펀딩이 맞는지, 예술지원사업이 더 맞는지도 같은 자리에서 봅니다.' },
      { title: '기획', body: '스토리와 리워드 구성, 목표액을 정합니다. 목표액은 수수료와 리워드 원가까지 넣어 거꾸로 계산합니다.' },
      { title: '페이지 제작', body: '정한 구성대로 스튜디오 놀 펀딩 페이지를 구축합니다.' },
      { title: '펀딩 종료 후', body: `모금액에서 ${fundingFees}를 뗀 금액을 정산합니다. 성공 수수료는 없습니다.` },
    ],
  },
  alternatives: {
    title: '상황에 따라 다른 길도 있습니다',
    items: [
      {
        title: '제작·홍보·유통까지 이어 가려면',
        body: '펀딩으로 제작비를 만들고, 녹음·믹싱·마스터링과 매체 홍보, 협력 유통사 연결까지 한 팀이 끝까지 가는 발매 프로젝트가 있습니다.',
        href: '/ko/release-project',
        label: '발매 프로젝트',
      },
      {
        title: '직접 개설하고 싶다면',
        body: `설계를 맡기지 않고 스튜디오 놀 펀딩에 직접 신청할 수도 있습니다. 이때는 설계비 없이 모금액에서 ${fundingFees}만 뗍니다.`,
        href: '/ko/funding/apply',
        label: '펀딩 개설 신청',
      },
      {
        title: '먼저 공부해 보고 싶다면',
        body: '앨범 제작비를 크라우드펀딩으로 모으는 과정을 정리한 가이드부터 읽어 보세요.',
        href: '/ko/stories/music-crowdfunding1',
        label: '음악 크라우드펀딩 가이드',
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
        answer: `설계비 ${designFee}(부가세 별도)입니다. 성공 수수료는 받지 않습니다. 펀딩이 끝나면 모금액에서 ${fundingFees}를 뗀 금액을 정산해 드립니다.`,
      },
      {
        question: '펀딩이 목표에 못 미치면 어떻게 되나요?',
        answer: '스튜디오 놀 펀딩은 목표에 못 미쳐도 모인 금액으로 진행하는 방식입니다. 그래서 후원자에게 약속한 리워드는 그대로 보내야 합니다. 목표액은 이 점까지 감안해 상담에서 함께 정합니다.',
      },
      {
        question: '실제로 진행한 펀딩을 볼 수 있나요?',
        answer: `네. 이 페이지의 "진행한 펀딩" 표에 운영자가 기획·운영한 펀딩 가운데 텀블벅·씨앗페에서 공개로 확인할 수 있는 것을 링크와 함께 실었습니다(${casesLine}, ${CASES_CHECKED_ON} 확인). 음반이 가장 많고, 공연·출판·영화 상영 펀딩도 있습니다.`,
      },
      {
        question: '어떤 플랫폼에서 진행하나요?',
        answer: '스튜디오 놀 펀딩(이 사이트)에서 엽니다. 후원 결제·리워드 관리·정산까지 이 사이트에서 이뤄집니다.',
      },
      {
        question: '직접 개설하는 것과 무엇이 다른가요?',
        answer: `스튜디오 놀 펀딩은 누구나 직접 신청할 수 있고, 그때는 설계비 없이 ${fundingFees}만 뗍니다. 설계 대행은 스토리·리워드·목표액·페이지를 기획부터 함께 만드는 일입니다.`,
      },
      {
        question: '예술지원사업도 함께 상담할 수 있나요?',
        answer: '네. 예술지원사업(예술위·지역 문예진흥) 지원 방향도 같은 상담에서 함께 봅니다. 신청서는 본인이 쓰고, 선정 여부는 심사 기관이 정하는 일이라 보장할 수 없습니다.',
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
