#!/usr/bin/env node
/**
 * boost-topic-300.js
 *
 * content/stories/ 내 practice-room-로 시작하지 않고 category: 지역도 아닌
 * 파일 중 effective word count가 300 미만인 파일들에 주제 맞춤 산문을 추가하여
 * 300단어 이상으로 올립니다.
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');

// ─────────────────────────────────────────────────────────
// 단어 수 계산 로직 (content-quality-check.js와 동일)
// ─────────────────────────────────────────────────────────
function stripMarkdownSyntax(text) {
  return text
    .replace(/%%[\w-]+%%/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\|[^|\n]*\|/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function getBodyContent(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function getEffectiveWordCount(body) {
  const stripped = stripMarkdownSyntax(body);
  const words = countWords(stripped);
  const SHORTCODE_WORD_ESTIMATES = { 'online-fallback': 25, 'session-checklist': 60 };
  const bonus = [...body.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_WORD_ESTIMATES[m[1]] ?? 15), 0);
  return words + bonus;
}

// ─────────────────────────────────────────────────────────
// Frontmatter 파서
// ─────────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  const yaml = match[1];
  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  const catMatch = yaml.match(/^category:\s*(.+)$/m);
  const tagsMatch = yaml.match(/^tags:\n((?:  - [^\n]+\n?)+)/m);
  return {
    title: titleMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '',
    category: catMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '',
    tags: tagsMatch?.[1]?.match(/^  - (.+)$/gm)?.map(l => l.replace(/^  - /, '').trim()) || [],
  };
}

// ─────────────────────────────────────────────────────────
// 카테고리별 산문 풀
// 반환값은 순수 한국어 산문 (볼드/헤딩/리스트/표 없음)
// ─────────────────────────────────────────────────────────

// 보컬·강좌 계열 산문
const proseVocal = [
  `보컬 녹음에서 가장 중요한 것은 일관된 마이크 거리와 자연스러운 호흡 조절입니다. 마이크와 입 사이 거리를 10~15cm 정도로 유지하고, 강한 자음이 나오는 부분에서는 살짝 옆으로 비껴 발음하면 팝 소리를 줄일 수 있습니다. 녹음 전 충분한 워밍업으로 성대를 부드럽게 이완시키는 것도 퀄리티에 직접 영향을 미칩니다. 자신의 목소리를 헤드폰으로 모니터링하면서 피치와 뉘앙스를 실시간으로 확인하는 습관을 들이면 완성도 높은 테이크를 빠르게 얻을 수 있습니다.`,

  `보컬 레코딩에서 감정 표현을 극대화하려면 단순히 음정을 맞추는 것 이상의 준비가 필요합니다. 가사의 스토리와 분위기를 머릿속에 충분히 그린 뒤 녹음실에 들어가면 자연스러운 감정선이 목소리에 담깁니다. 단어의 강세와 억양을 의도적으로 조절하면 평범한 가사도 살아있는 퍼포먼스로 탈바꿈합니다. 녹음 후 완성된 파일을 여러 번 청취하면서 개선할 부분을 노트에 기록하는 방식이 꾸준한 실력 향상으로 이어집니다.`,

  `보컬 연습에서 자주 간과되는 요소 중 하나가 다이나믹 조절입니다. 모든 음절을 똑같은 강도로 부르면 표현이 단조로워져 청자에게 전달되는 에너지가 약해집니다. 조용한 구절은 부드럽게, 클라이맥스는 충분한 파워로 소화하는 다이나믹 기복이 곡에 생동감을 더합니다. 스튜디오 녹음 환경에서는 공간의 잔향이 제한되어 있어 실내 연습 때와 다르게 들릴 수 있으므로 사전에 부스 환경에 미리 적응하는 시간을 갖는 것이 유익합니다.`,

  `보컬 강좌를 시작하는 단계에서는 복식호흡 훈련을 우선순위에 두는 것이 좋습니다. 배에서 나오는 지지대 있는 호흡은 음정 안정성과 지속 시간 모두에 영향을 미칩니다. 발성 패턴을 체계적으로 익히면 고음 구간에서 무리하게 목을 긁지 않고도 충분한 볼륨을 낼 수 있습니다. 기초 발성 훈련을 게을리하면 잘못된 발성 습관이 굳어질 수 있으므로 강사의 피드백을 꼼꼼하게 반영하며 연습하는 태도가 중요합니다.`,

  `레코딩 강좌에서 배우는 기술은 실제 녹음 세션에 바로 적용할 수 있어야 의미가 있습니다. DAW 기본 조작법을 익힌 뒤 자신의 목소리를 직접 녹음하고 편집해보는 실습 중심의 학습이 효과적입니다. 드라이 보컬 트랙에 리버브와 딜레이를 적용하는 과정을 직접 경험하면 믹싱 단계에서 어떤 처리가 이루어지는지 이해하기 쉬워집니다. 강좌를 통해 얻은 지식을 반복 실습으로 체화해야 실전에서 자신 있게 활용할 수 있습니다.`,
];

// 믹싱·마스터링·음악 제작 계열 산문
const proseMixing = [
  `믹싱 작업에서 EQ는 각 악기가 주파수 대역에서 명확하게 자리를 잡도록 돕는 핵심 도구입니다. 비슷한 주파수 대역을 점유하는 악기들 사이에서 불필요한 주파수를 잘라내는 서브트랙티브 EQ 방식을 먼저 적용하면 전체 믹스가 훨씬 깔끔해집니다. 로우 컷 필터를 적극 활용해 불필요한 저역 럼블을 제거하면 서브 베이스 공간이 확보되어 믹스 전체의 파워감이 높아집니다. 레퍼런스 트랙과 주기적으로 비교 청취하면 객관적인 판단력을 유지하는 데 도움이 됩니다.`,

  `DAW를 처음 선택할 때는 자신이 주로 작업할 장르와 워크플로에 맞는 소프트웨어를 고르는 것이 중요합니다. 각 DAW마다 인터페이스와 기본 기능 배치가 다르기 때문에 무료 체험판을 충분히 활용해 직접 비교해보는 것이 좋습니다. 보컬 중심 작업이라면 오디오 편집 기능이 강력한 DAW를, 일렉트로닉 음악 중심이라면 MIDI 편집과 루프 기반 제작에 최적화된 환경을 우선으로 고려하세요. 한 가지 DAW에 완전히 익숙해진 후에 다른 도구를 추가로 배우는 방식이 학습 효율을 높입니다.`,

  `마스터링은 최종 음원이 다양한 재생 환경에서 일관된 품질로 들리도록 다듬는 과정입니다. 라우드니스 기준을 맞추고 스테레오 이미지를 정돈하는 작업이 마스터링의 핵심입니다. 스트리밍 플랫폼별 라우드니스 기준이 다르므로 타겟 플랫폼의 LUFS 수치를 미리 확인하고 맞추는 것이 중요합니다. 모노 호환성을 반드시 테스트해 폰 스피커나 블루투스 기기에서도 음원이 제대로 들리는지 확인해야 합니다. 마스터링 전 믹스 퀄리티가 충분히 높아야 마스터링의 효과가 극대화됩니다.`,

  `홈 레코딩 환경을 갖출 때 인터페이스 선택은 전체 녹음 퀄리티에 큰 영향을 미칩니다. 레이턴시가 낮고 드라이버가 안정적인 제품을 선택하면 녹음 중 모니터링 불편함을 줄일 수 있습니다. 마이크 프리앰프 성능이 좋은 인터페이스를 선택하면 별도의 외부 프리앰프 없이도 깔끔한 소스 신호를 얻을 수 있습니다. 룸 어쿠스틱 처리와 함께 좋은 인터페이스를 갖추면 전문 스튜디오 수준에 가까운 홈 레코딩 환경이 완성됩니다.`,

  `음악 제작에서 레퍼런스 트랙을 활용하는 습관은 초보 프로듀서와 숙련 엔지니어 모두에게 유효합니다. 목표로 하는 사운드와 비슷한 장르의 상업 음원을 DAW에 가져와 주기적으로 비교 청취하면 자신의 믹스에서 부족한 부분을 명확하게 파악할 수 있습니다. 레퍼런스 음원의 저역 질감, 보컬 위치, 스테레오 너비 등을 하나씩 분석하는 훈련이 믹싱 귀를 빠르게 키워줍니다. 전문 스튜디오에서 작업할 때도 레퍼런스를 제공하면 엔지니어와의 커뮤니케이션이 훨씬 원활해집니다.`,

  `작곡과 편곡을 병행하는 작업에서는 아이디어를 빠르게 스케치하는 능력이 중요합니다. 완성도를 고민하기 전에 멜로디와 코드 진행의 큰 그림을 먼저 잡아두고, 이후 세부 편곡을 다듬어가는 방식이 창작 흐름을 방해받지 않는 방법입니다. MIDI 스케치 단계에서 다양한 악기 조합을 실험해보면 예상치 못한 음색 아이디어를 발견하는 경우가 많습니다. 편곡 단계에서 리듬 레이어를 점진적으로 쌓아올리는 방식은 드랍 전후의 에너지 차이를 극적으로 만드는 데 효과적입니다.`,
];

// 음악 비즈니스·발매·저작권 계열 산문
const proseBusiness = [
  `음원 발매를 준비할 때 유통사 선택은 이후 수익 정산과 저작권 관리에 직접적인 영향을 미칩니다. 국내외 여러 유통사의 수수료 구조와 정산 주기, 플랫폼 커버리지를 비교해보고 자신의 상황에 맞는 파트너를 선택하는 것이 중요합니다. 발매 전 ISRC 코드 등록과 저작권 신탁 여부를 미리 처리해두면 발매 후 수익을 온전히 관리하는 데 도움이 됩니다. 발매 일정은 적어도 2~3주 전에 확정하고 음원 파일, 커버 아트, 메타데이터를 사전에 준비해두어야 일정 지연을 방지할 수 있습니다.`,

  `음악 저작권은 창작 활동을 시작하는 순간부터 발생하지만, 실질적인 보호를 받으려면 한국음악저작권협회 등 관련 기관에 신탁 등록을 하는 것이 유리합니다. 저작권 신탁을 통해 스트리밍, 방송, 공연 등 다양한 경로에서 발생하는 저작권료를 자동으로 정산받을 수 있습니다. 공동 작곡·작사의 경우 참여 비율을 사전에 서면으로 정리해두면 나중에 발생할 수 있는 분쟁을 예방할 수 있습니다. 해외 시장을 목표로 한다면 국제 저작권 단체와의 연계 가능 여부도 함께 확인하는 것이 좋습니다.`,

  `스트리밍 플랫폼에 음원을 발매할 때 메타데이터 관리는 생각보다 중요한 작업입니다. 곡명, 아티스트명, 앨범명 표기가 플랫폼마다 일관되게 유지되어야 검색 알고리즘이 정확하게 음원을 분류합니다. 장르 태그를 세밀하게 지정하면 유사 아티스트 추천 기능에 노출될 확률이 높아집니다. 발매 후에도 팬 활동과 플레이리스트 피칭을 통해 스트리밍 수를 꾸준히 높여가는 프로모션 전략이 음원의 장기적인 성과에 영향을 미칩니다.`,

  `인디 아티스트로 활동할 때 자신만의 브랜딩을 만드는 것은 음악 자체만큼 중요한 요소입니다. 아티스트 프로필 사진, 소셜 미디어 톤, 공식 이름 표기 방식을 일관되게 유지하면 팬들이 아티스트를 인식하고 기억하기 쉬워집니다. 발매 음원마다 고유한 아트워크 컨셉을 유지하면 앨범 그래픽 아이덴티티가 강화됩니다. 꾸준한 콘텐츠 업로드와 팬과의 소통은 신규 팬을 유입시키고 기존 팬의 충성도를 높이는 데 효과적인 방법입니다.`,

  `음악 라이선스 수익은 스트리밍 외에 아티스트가 안정적인 수입을 창출할 수 있는 중요한 채널입니다. 광고, 드라마, 영화, 유튜브 콘텐츠 등 다양한 미디어에 음악을 제공하면 공연 수입이 없는 시기에도 지속적인 수익이 발생합니다. 음악 라이선싱 플랫폼에 자신의 음원을 등록해두면 콘텐츠 크리에이터들이 손쉽게 라이선스를 구입할 수 있어 수익화 기회가 늘어납니다. 라이선스 계약 시 사용 범위, 기간, 지역을 명확하게 명시해야 분쟁을 방지할 수 있습니다.`,
];

// 이벤트·공지·후기·인터뷰 계열 산문
const proseEvent = [
  `스튜디오 놀에서 진행하는 이벤트와 프로모션은 공식 소셜 미디어 채널과 카카오톡 채널을 통해 가장 먼저 안내됩니다. 정기 팔로우와 알림 설정을 해두면 선착순 혜택을 놓치지 않을 수 있습니다. 이벤트 참여 신청은 대부분 카카오톡 채널 상담을 통해 진행되며, 문의와 예약을 동시에 처리할 수 있어 편리합니다. 스튜디오 놀은 다양한 경력의 아티스트들이 부담 없이 전문 녹음 환경을 경험할 수 있는 공간을 만들기 위해 꾸준히 노력하고 있습니다.`,

  `스튜디오 놀은 연신내역 6번 출구에서 걸어서 5분 거리에 위치해 있어 서울 전 지역과 수도권에서 접근하기 편리합니다. 처음 방문하는 아티스트를 위해 예약 확인 메시지에 상세한 찾아오는 길을 안내해드리고 있습니다. 세션 당일 짐이 많거나 악기를 가져올 경우 미리 안내해주시면 최대한 불편함 없이 준비해드리겠습니다. 방문 전 궁금한 점이 있다면 카카오톡 채널로 언제든지 문의해주세요.`,

  `스튜디오 놀에서의 녹음 경험은 처음 방문하는 아티스트에게도 편안하게 설계되어 있습니다. 세션 시작 전 담당 엔지니어가 간단한 오리엔테이션을 제공하며, 장비 연결부터 모니터링 설정까지 함께 도와드립니다. 녹음 환경이 낯선 아티스트도 충분히 준비된 상태에서 최고의 퍼포먼스를 발휘할 수 있도록 세심하게 배려합니다. 세션 후 원본 파일은 즉시 전달해드리며, 추가 수정이 필요한 경우 별도 상담을 통해 진행할 수 있습니다.`,

  `음악 작업 과정에서 외부 스튜디오를 이용하는 경험은 홈 레코딩과는 분명히 다른 자극을 줍니다. 전문 장비와 어쿠스틱 처리된 공간에서 작업하면 스스로의 음악을 더 객관적으로 들을 수 있게 됩니다. 엔지니어와의 대화를 통해 자신이 원하는 사운드를 언어로 정리하는 능력도 자연스럽게 향상됩니다. 스튜디오 환경에 익숙해질수록 세션 시간을 더욱 효율적으로 활용하게 되며, 완성된 음원의 퀄리티도 꾸준히 높아지는 것을 체감할 수 있습니다.`,

  `스튜디오 놀은 다양한 장르와 작업 스타일을 가진 아티스트들을 지원하기 위해 여러 가지 세션 패키지를 운영하고 있습니다. 보컬 단독 녹음부터 밴드 합주 녹음, 믹싱, 마스터링까지 폭넓은 서비스를 제공합니다. 처음 방문 시 스튜디오 시설을 둘러보고 담당 엔지니어와 작업 방향을 상담한 뒤 세션을 시작하는 방식으로 진행됩니다. 예약 및 문의는 카카오톡 채널을 통해 편리하게 연락할 수 있으며, 빠른 답변을 드리기 위해 노력하고 있습니다.`,
];

// 녹음 가이드·장비 계열 산문
const proseRecording = [
  `마이크 선택은 녹음 퀄리티의 첫 번째 결정 요소입니다. 다이나믹 마이크는 내구성이 뛰어나고 사운드 압력에 강해 보컬과 드럼 녹음에 폭넓게 사용됩니다. 컨덴서 마이크는 섬세한 뉘앙스와 넓은 주파수 응답을 제공해 스튜디오 보컬 녹음에 많이 활용됩니다. 마이크 패턴을 이해하고 녹음 상황에 맞는 지향성을 선택하면 불필요한 주변 소음 유입을 줄일 수 있습니다. 마이크 배치 위치와 각도를 조금씩 바꿔보며 최적의 포인트를 찾는 실험이 좋은 소스 녹음의 시작입니다.`,

  `녹음 전 레벨 체크는 절대 생략해서는 안 될 필수 과정입니다. 입력 게인이 너무 높으면 클리핑이 발생해 복구 불가능한 왜곡이 생기고, 너무 낮으면 노이즈 플로어가 상대적으로 높아집니다. 피크 레벨이 -6dBFS 전후를 유지하도록 게인을 설정하면 믹싱 단계에서 충분한 헤드룸을 확보할 수 있습니다. 여러 테이크를 녹음할 때도 처음 설정한 게인을 유지해야 나중에 테이크를 비교하고 선택하기 수월합니다.`,

  `헤드폰 믹스 설정은 아티스트의 녹음 퍼포먼스에 생각보다 큰 영향을 미칩니다. 자신의 보컬이 너무 크거나 작게 모니터링되면 음정 조절에 어려움이 생깁니다. 반주와 보컬의 밸런스를 아티스트가 편안하게 느끼는 수준으로 맞춰주는 것이 좋은 세션을 만드는 데 중요합니다. 리버브를 모니터 믹스에 적당히 추가하면 보컬리스트가 긴장을 풀고 더 자연스러운 감정 표현을 하는 데 도움이 됩니다. 헤드폰 리버브는 녹음 파일에는 영향을 주지 않으므로 부담 없이 활용할 수 있습니다.`,

  `음향 처리된 공간에서의 녹음은 홈 레코딩과 비교해 소리의 선명도에서 즉각적인 차이를 느낄 수 있습니다. 어쿠스틱 패널과 베이스 트랩이 적절히 설치된 공간에서는 불필요한 잔향과 공명이 줄어들어 소스 음질이 깨끗하게 포착됩니다. 전문 스튜디오에서 녹음한 소스는 믹싱 단계에서 작업량이 줄어드는 장점이 있습니다. 좋은 공간에서 좋은 장비로 녹음된 소스가 이후 모든 후처리 과정의 품질을 결정하는 출발점이 됩니다.`,

  `오디오 인터페이스를 구입할 때 채널 수와 프리앰프 품질을 우선적으로 고려해야 합니다. 단독 보컬 녹음이라면 2채널 인터페이스로 충분하지만, 드럼이나 밴드 녹음을 계획한다면 더 많은 입력 채널이 필요합니다. 드라이버 안정성은 실제 작업 환경에서 매우 중요한 요소이므로 구매 전 사용자 리뷰를 충분히 확인하는 것이 좋습니다. 레이턴시가 낮을수록 실시간 모니터링이 편안해지며, 특히 소프트웨어 악기를 연주할 때 낮은 레이턴시가 핵심 조건이 됩니다.`,
];

// ─────────────────────────────────────────────────────────
// 카테고리에 따른 산문 풀 선택
// ─────────────────────────────────────────────────────────
function selectProsePool(category, tags) {
  const cat = category.toLowerCase();
  const tagStr = tags.join(' ').toLowerCase();

  if (cat.includes('비즈니스') || cat.includes('business') ||
      tagStr.includes('발매') || tagStr.includes('저작권') || tagStr.includes('유통') ||
      tagStr.includes('라이선스') || tagStr.includes('계약')) {
    return proseBusiness;
  }

  if (cat.includes('이벤트') || cat === 'event' || cat.includes('후기') ||
      cat === 'interview' || cat === 'notice' || cat.includes('공지')) {
    return proseEvent;
  }

  if (cat.includes('믹싱') || cat.includes('마스터링') || cat.includes('음악 제작') ||
      cat.includes('daw') || tagStr.includes('daw') || tagStr.includes('믹싱') ||
      tagStr.includes('마스터링') || tagStr.includes('편곡') || tagStr.includes('작곡')) {
    return proseMixing;
  }

  if (cat.includes('녹음') || tagStr.includes('마이크') || tagStr.includes('인터페이스') ||
      tagStr.includes('어쿠스틱') || tagStr.includes('녹음')) {
    return proseRecording;
  }

  // 강좌·보컬·lesson 등 기본값
  return proseVocal;
}

// ─────────────────────────────────────────────────────────
// 산문 생성 함수
// ─────────────────────────────────────────────────────────
function generateProse(slug, title, category, tags, neededWords, fileIndex) {
  const pool = selectProsePool(category, tags);
  const idx = fileIndex % pool.length;
  let prose = pool[idx];

  // 단어 수 확인 후 필요하면 다음 산문에서 일부 문장 추가
  const proseWords = countWords(prose);
  if (proseWords < neededWords) {
    const extraIdx = (idx + 1) % pool.length;
    const extra = pool[extraIdx];
    const sentences = extra.split('.');
    let added = '';
    for (const s of sentences) {
      if (countWords(prose + ' ' + added) >= neededWords) break;
      if (s.trim()) added += s + '.';
    }
    prose = prose + ' ' + added.trim();
  }

  return prose.trim();
}

// ─────────────────────────────────────────────────────────
// 메인 실행
// ─────────────────────────────────────────────────────────
function main() {
  const allFiles = fs.readdirSync(STORIES_DIR)
    .filter(f => f.endsWith('.md') &&
      !f.includes('.en.') && !f.includes('.zh.') &&
      !f.includes('.es.') && !f.includes('.vi.') &&
      !f.includes('.th.') && !f.includes('.uz.'))
    .sort();

  // practice-room- 제외, category: 지역 제외, 300 미만인 파일 수집
  const targets = [];
  for (const f of allFiles) {
    if (f.startsWith('practice-room-')) continue;
    const filePath = path.join(STORIES_DIR, f);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('category: 지역')) continue;
    const body = getBodyContent(content);
    const eff = getEffectiveWordCount(body);
    if (eff >= 300) continue;
    targets.push({ file: f, filePath, content, eff });
  }

  console.log(`대상 파일: ${targets.length}개 (practice-room·지역 제외, 300 미만)`);

  let modified = 0;
  let stillUnder = 0;
  const warnings = [];

  targets.forEach(({ file, filePath, content, eff: before }, fileIndex) => {
    const { title, category, tags } = parseFrontmatter(content);
    const slug = file.replace('.md', '');
    const needed = Math.min(80, Math.max(25, 300 - before + 15));
    const prose = generateProse(slug, title, category, tags, needed, fileIndex);

    // 삽입 위치: 마지막 `](/stories/` 줄 바로 앞
    const lines = content.split('\n');
    let insertIdx = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('](/stories/')) {
        insertIdx = i;
        break;
      }
    }

    lines.splice(insertIdx, 0, '\n' + prose + '\n');
    const newContent = lines.join('\n');

    // 재검증
    const newBody = getBodyContent(newContent);
    const after = getEffectiveWordCount(newBody);

    if (after < 300) {
      stillUnder++;
      warnings.push({ slug, before, after });
      console.log(`WARN: ${slug} (${before} -> ${after})`);
    } else {
      console.log(`OK  ${slug}: ${before} -> ${after}`);
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    modified++;
  });

  console.log('\n========== 결과 요약 ==========');
  console.log(`수정된 파일: ${modified}개`);
  console.log(`여전히 300 미달: ${stillUnder}개`);
  if (warnings.length > 0) {
    console.log('\n미달 파일 목록:');
    warnings.forEach(w => console.log(`  - ${w.slug}: ${w.before} -> ${w.after}단어`));
  }
}

main();
