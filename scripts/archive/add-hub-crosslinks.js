#!/usr/bin/env node
/**
 * add-hub-crosslinks.js
 * Adds hub page links (KTX Gyeongbu, KTX Honam, Seoul Metro) to
 * city/location guide pages in their footer cross-link sections.
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');

// Hub definitions
const HUBS = {
  gyeongbu: {
    link: '[경부선 KTX 가이드](/stories/ktx-gyeongbu-guide1)',
    selfSlug: 'ktx-gyeongbu-guide1',
    slugs: [
      'busan', 'daegu', 'daejeon', 'ulsan', 'pohang', 'changwon', 'gimhae',
      'geoje', 'gumi', 'gyeongju', 'asan', 'cheonan', 'gimcheon', 'miryang',
      'yangsan', 'gyeongsan', 'chilgok', 'andong', 'sangju', 'suseong',
      'yeongcheon', 'gyeongbuk'
    ]
  },
  honam: {
    link: '[호남선 KTX 가이드](/stories/ktx-honam-guide1)',
    selfSlug: 'ktx-honam-guide1',
    slugs: [
      'gwangju1', 'gwangju-sangmu', 'jeonju', 'iksan', 'mokpo', 'suncheon',
      'yeosu', 'gunsan', 'naju', 'jeongeup', 'gongju', 'jangseong', 'nonsan',
      'damyang', 'muan', 'boseong', 'goheung', 'gokseong', 'gurye',
      'hampyeong', 'haenam', 'hwasun', 'jangheung', 'jindo', 'sinan',
      'wando', 'yeonggwang', 'buan', 'gochang', 'imsil', 'jangsu', 'jinan',
      'kimje', 'namwon', 'sunchang', 'wanju', 'jeonnam', 'jeonbuk', 'chungnam'
    ]
  },
  seoul_metro: {
    link: '[수도권 녹음실 가이드](/stories/seoul-metro-guide1)',
    selfSlug: 'seoul-metro-guide1',
    slugs: [
      // Seoul areas
      'gangnam', 'hongdae', 'jamsil', 'jongno', 'mapo', 'yongsan',
      'sinchon', 'itaewon', 'apgujeong', 'cheongdam', 'sinsa',
      'nonhyeon', 'yeoksam', 'suseo', 'seocho', 'songpa',
      'nowon', 'dobong', 'gangbuk', 'seongbuk', 'jungrang',
      'dongdaemun', 'seongdong', 'gwangjin', 'gangdong',
      'yeongdeungpo', 'guro', 'geumcheon', 'dongjak', 'gwanak',
      'gangseo', 'yangcheon', 'mapo', 'seodaemun', 'eunpyeong',
      'jung', 'yongsan', 'jongno',
      'wangsimni', 'konkuk', 'gunja', 'ttukseom', 'seongsu',
      'mangwon', 'hapjeong', 'sangsu', 'yeonnam',
      'mullae', 'sindorim', 'daerim', 'gasan', 'magok',
      'mokdong', 'yeouido', 'noryangjin',
      'sadang', 'nakseongdae', 'sillim', 'bongcheon',
      'cheonho', 'amsa', 'gildong', 'dunchon', 'bangi', 'ogeum',
      'suyu', 'mia', 'ssangmun', 'chang-dong', 'sanggye',
      'junggye', 'hagye', 'taereung',
      'hoegi', 'anam', 'bomun',
      'hannam', 'ichon', 'samgakji', 'sookmyung', 'hyochang',
      // Gyeonggi
      'bundang', 'suwon', 'incheon', 'bucheon', 'ilsan', 'goyang',
      'paju', 'gimpo', 'hanam', 'namyangju', 'guri', 'anyang',
      'gwacheon', 'gwangmyeong', 'uijeongbu', 'yangju', 'siheung',
      'hwaseong', 'osan', 'gunpo', 'uiwang', 'pyeongtaek',
      'dongducheon', 'pocheon', 'yongin', 'seongnam', 'icheon',
      'yeoju', 'yangpyeong', 'gapyeong', 'gwangju-gyeonggi',
      'gwangju-opoong',
      // Sub-areas of larger cities
      'ansan', 'anyang-manan', 'anyang-dongan', 'pyeongchon',
      'suji', 'giheung', 'dongtan', 'jukjeon',
      'sanbon', 'gwanggyo', 'yeongttong', 'uman',
      'bupyeong', 'songdo', 'namdong', 'yeonsu', 'seo-incheon',
      'juan', 'gyeyang',
      'jangam', 'byeollae', 'dasan', 'jinjeop',
      'deogyang', 'pungsan', 'juyeop',
      'gwangmyeong-haean', 'gwangmyeong-cheolsan',
      'ui', 'sinseol', 'jeongneung', 'gireum',
      'hwajeong', 'daehwa', 'baengma',
      'bisan', 'oksu', 'geumho', 'yaksu',
      'dangsan', 'singil', 'daerim',
      'munjeong', 'garak', 'wirye',
      'seongnae', 'myeonmok', 'junghwa', 'sangbong', 'mangu',
      'seoulforest', 'ttukseom', 'majang',
      'yangjae', 'dogok', 'daechi', 'gaepo',
      'banpo', 'jamwon', 'sapyeong',
    ]
  }
};

// Build a map: slug -> hub info
const slugToHub = new Map();
for (const [hubName, hub] of Object.entries(HUBS)) {
  for (const slug of hub.slugs) {
    // A slug can match if the filename starts with the slug
    if (!slugToHub.has(slug)) {
      slugToHub.set(slug, hub);
    }
  }
}

// Skip these hub pages themselves
const SKIP_SLUGS = new Set([
  'ktx-gyeongbu-guide1',
  'ktx-honam-guide1',
  'seoul-metro-guide1'
]);

function findHubForSlug(slug) {
  // Direct match first
  for (const [hubName, hub] of Object.entries(HUBS)) {
    if (hub.slugs.some(s => slug === s || slug.startsWith(s + '-') || slug.startsWith(s + '1'))) {
      return hub;
    }
  }
  return null;
}

function processFile(filepath, hub) {
  const content = fs.readFileSync(filepath, 'utf8');

  // Skip if hub link already exists
  if (content.includes(hub.selfSlug)) return false;

  const lines = content.split('\n');

  // Find the LAST non-empty line that contains `](/stories/`
  let lastCrosslinkIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() && lines[i].includes('](/stories/')) {
      lastCrosslinkIdx = i;
      break;
    }
  }

  if (lastCrosslinkIdx === -1) return false;

  // Append the hub link
  lines[lastCrosslinkIdx] = lines[lastCrosslinkIdx] + ' | ' + hub.link;

  fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
  return true;
}

// Main
const files = fs.readdirSync(STORIES_DIR).filter(f => {
  if (!f.endsWith('.md')) return false;
  if (/\.(en|zh|es|vi|th|uz)\.md$/.test(f)) return false;
  return true;
});

let addedCount = 0;
let skippedAlreadyHas = 0;
let noMatch = 0;

for (const file of files) {
  const slug = file.replace(/\.md$/, '');

  // Skip hub pages themselves
  if (SKIP_SLUGS.has(slug)) continue;

  const hub = findHubForSlug(slug);
  if (!hub) {
    noMatch++;
    continue;
  }

  if (processFile(path.join(STORIES_DIR, file), hub)) {
    addedCount++;
  } else {
    skippedAlreadyHas++;
  }
}

console.log(`Added hub crosslinks to ${addedCount} files`);
console.log(`Skipped (already has hub link): ${skippedAlreadyHas}`);
console.log(`No hub match: ${noMatch}`);
