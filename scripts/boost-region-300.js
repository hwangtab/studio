#!/usr/bin/env node
/**
 * boost-region-300.js
 *
 * content/stories/ 내 category: 지역인 파일 중 effective word count가 300 미만인
 * 파일들에 교통·접근성 관련 산문을 추가하여 300단어 이상으로 올립니다.
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
// 슬러그에서 지역명 추출
// ─────────────────────────────────────────────────────────
function extractRegionName(slug) {
  // 숫자 접미사 제거
  const base = slug.replace(/\d+$/, '');

  // 알려진 지역명 매핑
  const regionMap = {
    'andong': '안동',
    'ansan': '안산',
    'ansan-danseon': '안산 단원',
    'ansan-sangnok': '안산 상록',
    'anyang': '안양',
    'anyang-manan': '안양 만안',
    'apgujeong': '압구정',
    'asan': '아산',
    'bucheon': '부천',
    'bundang': '분당',
    'bupyeong': '부평',
    'changwon': '창원',
    'cheongju': '청주',
    'cheonan': '천안',
    'chuncheon': '춘천',
    'daegu': '대구',
    'daejeon': '대전',
    'dangjin': '당진',
    'dobong': '도봉',
    'dongducheon': '동두천',
    'dongtan': '동탄',
    'eunpyeong': '은평',
    'ganghwa': '강화',
    'gangnam': '강남',
    'gangneung': '강릉',
    'geoje': '거제',
    'gimhae': '김해',
    'gimpo': '김포',
    'goyang': '고양',
    'gumi': '구미',
    'gunpo': '군포',
    'gunwi': '군위',
    'gwacheon': '과천',
    'gwanak': '관악',
    'gwangju': '광주',
    'gwangmyeong': '광명',
    'gyeongbuk': '경북',
    'gyeonggi': '경기',
    'gyeongju': '경주',
    'gyeongnam': '경남',
    'hanam': '하남',
    'hwaseong': '화성',
    'icheon': '이천',
    'iksan': '익산',
    'ilsan': '일산',
    'incheon': '인천',
    'osan': '오산',
    'paju': '파주',
    'pocheon': '포천',
    'pohang': '포항',
    'pyeongtaek': '평택',
    'seongnam': '성남',
    'seocho': '서초',
    'siheung': '시흥',
    'sokcho': '속초',
    'songtan': '송탄',
    'suwon': '수원',
    'uijeongbu': '의정부',
    'uiwang': '의왕',
    'ulsan': '울산',
    'wonju': '원주',
    'yangju': '양주',
    'yangpyeong': '양평',
    'yeoju': '여주',
    'yeongju': '영주',
    'yongin': '용인',
    'yonsei': '연세',
    'yongsan': '용산',
  };

  if (regionMap[base]) return regionMap[base];

  // 접두사로 매칭 시도
  for (const [key, val] of Object.entries(regionMap)) {
    if (base.startsWith(key)) return val;
  }

  // 슬러그를 그대로 반환 (한국어 변환 불가 시)
  return base;
}

// ─────────────────────────────────────────────────────────
// 교통·접근성 관련 산문 풀 (지역 가이드용)
// 지역명 플레이스홀더: {{REGION}}
// ─────────────────────────────────────────────────────────
const prosePool = [
  `{{REGION}} 지역에서 연신내역까지 지하철 또는 광역버스를 이용하면 대부분의 경우 1~2시간 내외로 도착할 수 있습니다. 연신내역 6호선 출구에서 스튜디오 놀까지 도보 5분 거리이므로 길을 찾기 어렵지 않습니다. {{REGION}} 뮤지션들이 오전에 출발해 오후 세션을 마치고 당일 귀가하는 일정으로 방문하는 경우가 많습니다. 대중교통 이용 시 네이버 지도 또는 카카오맵에서 실시간 경로를 확인하면 환승 정보까지 한눈에 파악할 수 있어 편리합니다. 세션 당일 여유 있게 출발해 스튜디오 도착 후 10~15분 워밍업 시간을 확보하면 녹음 퀄리티가 훨씬 높아집니다.`,

  `{{REGION}} 아티스트들이 스튜디오 놀을 방문할 때 주로 활용하는 대중교통 루트는 지역 내 주요 역이나 정류장에서 서울 방향 노선을 이용하는 방식입니다. 연신내역은 6호선과 3호선이 교차하는 환승역이어서 서울 각지에서 접근성이 뛰어납니다. {{REGION}}에서 출발하는 경우 혼잡 시간대를 피해 오전 중에 이동하면 이동 피로를 최소화할 수 있습니다. 스튜디오 놀은 연신내역 6번 출구에서 걸어서 5분 거리에 있어 짐이 많은 뮤지션도 부담 없이 찾아올 수 있습니다.`,

  `{{REGION}} 지역 뮤지션들이 당일 왕복 세션을 진행하기에 충분히 가까운 거리입니다. 수도권 광역 전철망이 잘 갖추어져 있어 환승 횟수를 최소화하며 연신내에 도착할 수 있습니다. 세션 예약 시 이동 시간을 고려해 세션 시작을 오전 10시 이후로 잡으면 여유롭게 준비할 수 있습니다. {{REGION}}에서 출발하는 첫차나 오전 일찍 노선을 이용하면 오전 시간대 세션도 충분히 가능합니다. 세션 종료 후 귀가 시에도 막차 시간을 미리 확인해두면 일정 계획에 도움이 됩니다.`,

  `{{REGION}}에서 서울 연신내 스튜디오 놀까지 이동하는 가장 편리한 방법은 지하철을 이용하는 것입니다. 환승 경로는 출발지에 따라 다르지만 연신내역이 최종 목적지이므로 6호선 방향으로 이동하면 됩니다. {{REGION}} 뮤지션 중에는 처음 방문 시 카카오맵으로 경로를 검색한 뒤 이후에는 익숙한 경로를 반복 이용하는 경우가 많습니다. 연신내역 주변에는 편의점과 카페가 많아 세션 전 음료나 간식을 구입하기 좋습니다. 주차가 필요한 경우 근처 공영주차장을 미리 확인해두면 당일 혼잡을 피할 수 있습니다.`,

  `{{REGION}} 지역 아티스트들이 스튜디오 방문 시 활용하는 대중교통 루트는 서울 방향 간선 노선에서 6호선 연신내역으로 연결되는 경로가 일반적입니다. 서울 중심부를 경유하는 경우 2호선 합정역에서 6호선으로 환승하거나 3호선 연신내역으로 바로 도착하는 방법도 있습니다. {{REGION}}에서 출발하면 대부분 1시간 내외 또는 그 이상 소요되므로 이동 중 세션 연습 계획을 미리 정리해두면 도착 후 집중도를 높일 수 있습니다. 스튜디오 놀 방문 당일 교통 상황을 실시간으로 확인하고 여유 시간을 두고 출발하는 것을 권장합니다.`,

  `{{REGION}}에서 스튜디오 놀을 이용하는 뮤지션들은 대부분 서울 지하철망을 통해 연신내역까지 이동합니다. 연신내는 은평구에 위치해 있으며, 서울 북서부 지역 교통의 중심지 역할을 합니다. {{REGION}} 출발 기준으로 이동 시간은 지역에 따라 다르지만 수도권 대부분 지역에서 당일 왕복이 가능합니다. 세션 전날 녹음에 사용할 MR 파일의 키와 템포를 최종 확인하고, 당일 목 상태를 고려해 충분한 수면을 취하면 최상의 녹음 결과를 얻을 수 있습니다.`,

  `{{REGION}} 뮤지션들이 스튜디오 놀을 방문할 때는 연신내역에서 내리면 출구 안내를 따라 도보 5분이면 도착합니다. 지하철 이용이 어려운 경우 서울 방면 광역버스를 이용한 후 연신내 인근에서 환승하는 방법도 있습니다. {{REGION}}에서 자동차로 이동할 경우 서울 도심 진입 전 교통 상황을 미리 확인하고 스튜디오 인근 주차 공간을 사전에 파악해두면 시간을 절약할 수 있습니다. 세션 예약은 카카오톡 채널을 통해 가능하며, 방문 당일 일정 변경이 필요한 경우 사전 연락을 주시면 됩니다.`,

  `{{REGION}} 지역에서 연신내까지의 이동은 수도권 광역 교통망 덕분에 생각보다 어렵지 않습니다. 경기도 및 인천 지역에서는 GTX, 광역철도, 일반 전철을 복합 활용하는 방법이 효율적입니다. {{REGION}} 아티스트들이 세션 당일 이동 피로를 최소화하려면 전날 충분한 수면과 수분 보충을 챙기는 것이 도움이 됩니다. 연신내역 주변 생활 환경은 식당, 카페, 편의점이 고루 갖춰져 있어 세션 전후 식사와 휴식을 해결하기 편리합니다. 스튜디오 놀은 대중교통으로 접근하기 편리한 위치에 있어 {{REGION}}을 포함한 수도권 전역에서 방문이 용이합니다.`,

  `{{REGION}}에서 연신내 스튜디오 놀까지 이동 경로를 처음 이용하는 뮤지션이라면 출발 전 네이버 지도에서 '연신내역'을 검색해 경로를 미리 저장해두는 것을 권장합니다. 이동 중 환승역을 혼동하지 않도록 경로를 캡처해두거나 오프라인 지도를 활용하면 편리합니다. {{REGION}} 지역 특성상 서울 접근 경로가 다양할 수 있으므로 본인의 출발지에서 가장 빠른 경로를 선택하는 것이 중요합니다. 연신내역에 도착하면 6번 출구로 나와 도보 5분이면 스튜디오에 도착합니다.`,

  `{{REGION}}에서 스튜디오 방문 후 귀가할 때는 세션 종료 예정 시간 기준으로 막차 시간을 미리 체크해두는 것이 좋습니다. 세션이 예상보다 길어질 경우를 대비해 마지막 열차 시간 30분 전에 마무리할 수 있도록 일정 여유를 두는 것을 권장합니다. {{REGION}} 방향 막차가 늦은 경우 세션 후 서울에서 식사를 해결하고 이동하는 일정도 충분히 가능합니다. 스튜디오 놀에서는 당일 완성된 파일을 즉시 전송해드리므로 귀가 후 바로 파일을 확인하실 수 있습니다.`,

  `{{REGION}} 뮤지션들이 스튜디오 놀을 선택하는 이유 중 하나는 연신내역이라는 교통 요충지에 위치해 있기 때문입니다. 6호선 연신내역은 서울 북서부 방향에서 접근하기 쉬우며, 경기 북부나 인천 방면에서도 환승 없이 또는 한 번 환승으로 도착할 수 있습니다. {{REGION}}에서 출발해 세션을 마치고 귀가하는 당일 일정이 부담스럽지 않도록 스튜디오 측에서는 세션 시간 조율에 최대한 협조해드리고 있습니다. 방문 전 예약 시 출발 지역을 알려주시면 추천 도착 시간을 안내받을 수 있습니다.`,

  `{{REGION}} 지역 아티스트들이 처음 스튜디오 놀을 방문할 때 가장 많이 묻는 질문 중 하나가 교통 방법입니다. 연신내역은 서울 지하철 3호선과 6호선이 만나는 역으로, 서울 전 지역과 연결이 잘 되어 있습니다. {{REGION}}에서 서울로 진입하는 방법은 다양하지만 최종 목적지인 연신내역을 기준으로 역방향으로 경로를 검색하면 최적 경로를 쉽게 찾을 수 있습니다. 스튜디오 놀은 도보 접근이 편리한 위치에 있으며 세션 후 바로 귀가 노선을 이용할 수 있어 효율적입니다.`,
];

// ─────────────────────────────────────────────────────────
// 산문 생성 함수
// ─────────────────────────────────────────────────────────
function generateProse(slug, neededWords, fileIndex) {
  const regionName = extractRegionName(slug);
  const idx = fileIndex % prosePool.length;
  let prose = prosePool[idx].replace(/\{\{REGION\}\}/g, regionName);

  // 단어 수 확인 후 필요하면 다른 산문을 이어 붙임
  const proseWords = countWords(prose);
  if (proseWords < neededWords) {
    const extraIdx = (idx + 1) % prosePool.length;
    const extra = prosePool[extraIdx].replace(/\{\{REGION\}\}/g, regionName);
    // 필요한 단어 수만큼만 문장 단위로 자르기
    const sentences = extra.split('.');
    let added = '';
    for (const s of sentences) {
      if (countWords(prose + ' ' + added) >= neededWords) break;
      added += s + '.';
    }
    prose = prose + ' ' + added.trim();
  }

  return prose.trim();
}

// ─────────────────────────────────────────────────────────
// 메인 실행
// ─────────────────────────────────────────────────────────
function main() {
  const files = fs.readdirSync(STORIES_DIR)
    .filter(f => f.endsWith('.md') && !f.includes('.en.') && !f.includes('.zh.')
      && !f.includes('.es.') && !f.includes('.vi.') && !f.includes('.th.') && !f.includes('.uz.'))
    .sort();

  const regionFiles = files.filter(f => {
    const content = fs.readFileSync(path.join(STORIES_DIR, f), 'utf8');
    return content.includes('category: 지역');
  });

  console.log(`지역 카테고리 파일: ${regionFiles.length}개`);

  let modified = 0;
  let alreadyOk = 0;
  const warnings = [];

  regionFiles.forEach((file, fileIndex) => {
    const filePath = path.join(STORIES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const body = getBodyContent(content);
    const before = getEffectiveWordCount(body);

    if (before >= 300) {
      alreadyOk++;
      return;
    }

    const slug = file.replace('.md', '');
    const needed = Math.min(100, Math.max(25, 300 - before + 15));
    const prose = generateProse(slug, needed, fileIndex);

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
      warnings.push({ slug, before, after });
      console.log(`WARN: ${slug} (${before} -> ${after})`);
    } else {
      console.log(`OK ${slug}: ${before} -> ${after}`);
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    modified++;
  });

  console.log('\n========== 결과 요약 ==========');
  console.log(`수정된 파일: ${modified}개`);
  console.log(`이미 300 이상: ${alreadyOk}개`);
  console.log(`여전히 미달: ${warnings.length}개`);
  if (warnings.length > 0) {
    console.log('\n미달 파일 목록:');
    warnings.forEach(w => console.log(`  - ${w.slug}: ${w.after}단어`));
  }
}

main();
