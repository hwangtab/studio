#!/usr/bin/env node
/**
 * 광역 허브 페이지 18개 콘텐츠 보강 (Phase 1 Step C).
 *
 * 변경:
 *   1. 기존 AUTO-EXPAND-V1 블록 제거 (광역 허브에는 부적절한 도시명 치환 boilerplate)
 *   2. <!-- HUB-CITIES-V1 ... /HUB-CITIES-V1 --> 안에 시·군 가이드 표 삽입
 *   3. 광역별 narrative 보강 (옵션, 광역에 따라)
 *
 * 멱등성: HUB-CITIES-V1 marker가 있으면 그 안 내용만 재생성. 재실행 안전.
 *
 * 사용:
 *   node scripts/enrichRegionHubs.js          # dry-run
 *   node scripts/enrichRegionHubs.js --apply  # 실제 적용
 */
const fs = require('node:fs');
const path = require('node:path');

const STORIES_DIR = path.join(process.cwd(), 'content', 'stories');
const apply = process.argv.includes('--apply');

const HUB_CITIES = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'lib', 'regionHubCities.json'), 'utf8'),
);

const AUTO_EXPAND_REGEX = /<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/g;
const HUB_CITIES_REGEX = /<!--\s*HUB-CITIES-V1\s*-->[\s\S]*?<!--\s*\/HUB-CITIES-V1\s*-->/g;

const HUB_LABEL = {
  seoul1: '서울특별시',
  incheon1: '인천광역시',
  gwangju1: '광주광역시',
  daegu1: '대구광역시',
  busan1: '부산광역시',
  ulsan1: '울산광역시',
  daejeon1: '대전광역시',
  sejong1: '세종특별자치시',
  gyeonggi1: '경기도',
  gangwon1: '강원도',
  chungbuk1: '충청북도',
  chungnam1: '충청남도',
  jeonbuk1: '전라북도',
  jeonnam1: '전라남도',
  gyeongbuk1: '경상북도',
  gyeongnam1: '경상남도',
  jeju1: '제주특별자치도',
  nationwide1: '전국',
};

const cleanCityName = (raw, slug) => {
  if (!raw) return slug.replace(/1$/, '');
  return raw
    .replace(/(녹음실|스튜디오|음악연습실|연습실|추천)$/, '')
    .replace(/시$/, '')
    .trim() || slug.replace(/1$/, '');
};

// 시·군 목록 정제: 시리즈 페이지(practice-room, KTX 가이드 등) 제외 + 슬러그 prefix 그룹별 대표 1개.
const dedupeAndFilterCities = (cities) => {
  // 1) 카테고리상 시·군 가이드가 아닌 슬러그 제외
  const filtered = cities.filter((c) => {
    const slug = c.slug;
    if (slug.startsWith('practice-room-') || slug === 'practice1') return false;
    if (slug.startsWith('ktx-') || slug.includes('-guide')) return false;
    return true;
  });
  // 2) 슬러그 prefix 그룹별 대표 1개 (가장 짧은 = base 슬러그)
  const groups = new Map();
  for (const c of filtered) {
    const base = c.slug.replace(/[0-9]+$/, '').split('-')[0];
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(c);
  }
  const reps = [];
  for (const [, list] of groups) {
    list.sort((a, b) => a.slug.length - b.slug.length);
    reps.push(list[0]);
  }
  return reps.sort((a, b) => a.slug.localeCompare(b.slug));
};

const buildCitiesSection = (hub, cities) => {
  const label = HUB_LABEL[hub] || hub;
  const reps = dedupeAndFilterCities(cities);
  const lines = [];
  lines.push('<!-- HUB-CITIES-V1 -->');
  lines.push('');
  lines.push(`## ${label}에서 자주 방문하시는 시·군·구`);
  lines.push('');
  if (reps.length === 0) {
    lines.push(`${label} 출발 안내는 본문 위 권역별 동선표를 참고해주세요. 정확한 출발지를 카카오톡으로 알려주시면 가장 빠른 환승 경로를 안내드립니다.`);
  } else {
    // 한글 cityName 기준 가나다 정렬, 중복 제거 후 prose list로
    const citySet = new Set();
    for (const c of reps) {
      const name = cleanCityName(c.cityName, c.slug);
      if (name && name.length >= 1 && !/^[a-z]/.test(name)) citySet.add(name);
    }
    const cityList = [...citySet].sort((a, b) => a.localeCompare(b, 'ko'));
    lines.push(`${label} 안에서 스튜디오 놀까지 방문하시는 분들이 자주 출발하시는 권역은 다음과 같습니다 — ${cityList.join(', ')} 등 ${reps.length}개 권역. 동·역 단위에서 출발하시더라도 같은 권역 안이면 동일한 환승 경로로 접근 가능합니다.`);
    lines.push('');
    lines.push(`### 권역별 안내`);
    lines.push('');
    lines.push(`출발 권역에 따라 환승 경로와 평균 소요 시간이 달라집니다. 본문 위 광역 동선표를 참고하시고, 정확한 출발지를 카카오톡으로 알려주시면 권장 출발 시간을 안내드립니다.`);
  }
  lines.push('');
  lines.push('<!-- /HUB-CITIES-V1 -->');
  return lines.join('\n');
};

const insertCitiesSection = (raw, section) => {
  // 1. 기존 HUB-CITIES 블록이 있으면 그걸 교체 (idempotent)
  if (HUB_CITIES_REGEX.test(raw)) {
    HUB_CITIES_REGEX.lastIndex = 0;
    return raw.replace(HUB_CITIES_REGEX, section);
  }

  // 2. "## 마치며" 직전에 삽입
  const marker = '## 마치며';
  const idx = raw.indexOf(marker);
  if (idx > 0) {
    return raw.slice(0, idx) + section + '\n\n' + raw.slice(idx);
  }

  // 3. footer cross-link 줄(첫 줄에 [text](/stories/...)) 직전에 삽입
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().startsWith('[') && lines[i].includes('](/stories/')) {
      lines.splice(i, 0, section, '');
      return lines.join('\n');
    }
  }

  // 4. 본문 끝
  return raw.trimEnd() + '\n\n' + section + '\n';
};

const main = () => {
  const summary = [];
  for (const [hub, cities] of Object.entries(HUB_CITIES)) {
    const f = path.join(STORIES_DIR, `${hub}.md`);
    if (!fs.existsSync(f)) {
      console.warn(`(skip) 파일 없음: ${f}`);
      continue;
    }
    const before = fs.readFileSync(f, 'utf8');
    let after = before;

    // AUTO-EXPAND 블록 제거
    const hadAutoExpand = AUTO_EXPAND_REGEX.test(after);
    AUTO_EXPAND_REGEX.lastIndex = 0;
    after = after.replace(AUTO_EXPAND_REGEX, '').replace(/\n{3,}/g, '\n\n');

    // HUB-CITIES 섹션 삽입/갱신
    const section = buildCitiesSection(hub, cities);
    after = insertCitiesSection(after, section);

    // trailing 정리
    after = after.replace(/\n{3,}/g, '\n\n');

    const beforeLen = before.replace(/\s+/g, '').length;
    const afterLen = after.replace(/\s+/g, '').length;

    summary.push({
      hub,
      cities: cities.length,
      beforeLen,
      afterLen,
      delta: afterLen - beforeLen,
      hadAutoExpand,
    });

    if (apply && before !== after) {
      fs.writeFileSync(f, after, 'utf8');
    }
  }

  console.log(`\n[${apply ? 'APPLY' : 'DRY-RUN'}] 광역 허브 ${summary.length}개`);
  console.log(`\n${'hub'.padEnd(15)} ${'cities'.padStart(7)} ${'before'.padStart(6)} ${'after'.padStart(6)} ${'delta'.padStart(6)} AUTO-EXPAND`);
  for (const s of summary.sort((a, b) => b.cities - a.cities)) {
    console.log(`${s.hub.padEnd(15)} ${String(s.cities).padStart(7)} ${String(s.beforeLen).padStart(6)} ${String(s.afterLen).padStart(6)} ${String(s.delta).padStart(6)} ${s.hadAutoExpand ? '제거됨' : '없음'}`);
  }
  if (!apply) console.log('\n  --apply로 실제 적용');
};

main();
