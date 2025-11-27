export const VAT_NOTICE = '모든 가격은 VAT(부가가치세) 별도입니다.';

export const recordingOffers = [
  {
    id: 'recording-hourly',
    title: '시간당 레코딩',
    priceDisplay: '100,000원',
    priceValue: 100000,
    unit: '/ 시간',
    description: '짧은 녹음이나 성우 녹음, 간단한 악기 녹음에 적합합니다.',
    features: ['전문 엔지니어링 포함', '최소 2시간부터 예약 가능', '보컬 디렉팅 지원', '실시간 모니터링 및 피드백'],
  },
  {
    id: 'recording-daylock',
    title: '6시간 패키지 (Day Lock)',
    priceDisplay: '500,000원',
    priceValue: 500000,
    unit: '/ 일',
    description: '앨범 작업 등 장시간 녹음이 필요할 때 합리적인 선택입니다.',
    recommended: true,
    features: ['6시간 패키지 (약 17% 할인)', '충분한 휴식과 여유로운 작업', '식사 시간 포함', '장시간 집중이 필요한 프로젝트에 최적'],
  },
];

export const mixingOffers = [
  {
    id: 'mixing-level1',
    title: 'Level 1',
    priceDisplay: '200,000원',
    priceValue: 200000,
    unit: '/ 곡',
    description: '심플한 구성의 곡에 적합합니다.',
    features: ['10 트랙 이하', '보컬 + MR 또는 소편성 악기', '기본 2회 수정 포함', '밸런스 및 톤 보정'],
  },
  {
    id: 'mixing-level2',
    title: 'Level 2',
    priceDisplay: '350,000원',
    priceValue: 350000,
    unit: '/ 곡',
    description: '일반적인 밴드 구성이나 팝 음악에 적합합니다.',
    recommended: true,
    features: ['11 ~ 30 트랙', '풀 밴드 구성 또는 팝 편곡', '기본 2회 수정 포함', '디테일한 이펙팅 및 공간감 형성'],
  },
  {
    id: 'mixing-level3',
    title: 'Level 3',
    priceDisplay: '500,000원',
    priceValue: 500000,
    unit: '/ 곡',
    description: '대편성 오케스트라나 복잡한 레이어의 곡에 적합합니다.',
    features: ['31 트랙 이상', '대편성 또는 복잡한 일렉트로닉', '기본 2회 수정 포함', '최고 수준의 디테일 작업'],
  },
];

export const masteringOffers = [
  {
    id: 'mastering-single',
    title: '싱글 마스터링',
    priceDisplay: '100,000원',
    priceValue: 100000,
    unit: '/ 곡',
    description: '디지털 싱글 발매를 위한 최적의 마스터링입니다.',
    features: ['스트리밍 플랫폼 규격 준수', '기본 1회 수정 포함', '고해상도 음원 제공', '장르별 최적화된 라우드니스 설정'],
  },
  {
    id: 'mastering-album',
    title: 'EP / 앨범 패키지',
    priceDisplay: '80,000원',
    priceValue: 80000,
    unit: '/ 곡',
    description: '4곡 이상의 앨범 작업 시 적용되는 할인 가격입니다.',
    recommended: true,
    features: ['4곡 이상 진행 시 적용', '앨범 전체의 톤 앤 매너 통일', '곡 간 레벨 밸런싱', '기본 1회 수정 포함'],
  },
];

export const additionalServices = [
  {
    id: 'service-consulting',
    title: '기획/컨설팅',
    priceDisplay: '50,000원',
    priceValue: 50000,
    unit: '/ 시간',
    description: '프로젝트 기획, 일정 관리, 예산 수립 등 전반적인 앨범 제작 컨설팅',
  },
  {
    id: 'service-funding',
    title: '펀딩 설계 대행',
    priceDisplay: '400,000원',
    priceValue: 400000,
    description: '텀블벅 등 크라우드 펀딩 페이지 기획, 스토리텔링, 리워드 설계',
    note: '+ 성공 수수료 10% (후불)',
  },
  {
    id: 'service-promo',
    title: '기본 홍보 패키지',
    priceDisplay: '300,000원',
    priceValue: 300000,
    description: '전문 보도자료 작성 및 언론 배포, 주요 음악 사이트 앨범 소개 등록 대행',
  },
  {
    id: 'service-epk',
    title: 'EPK 웹사이트',
    priceDisplay: '500,000원',
    priceValue: 500000,
    description: '아티스트/앨범 소개를 위한 반응형 웹사이트 제작 (Electronic Press Kit)',
  },
];
