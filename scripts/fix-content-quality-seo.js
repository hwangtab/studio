#!/usr/bin/env node
/**
 * SEO-focused content quality fixer for Korean story frontmatter.
 *
 * Dry-run by default:
 *   node scripts/fix-content-quality-seo.js
 *
 * Apply changes:
 *   node scripts/fix-content-quality-seo.js --apply
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STORIES_DIR = path.join(ROOT, 'content', 'stories');
const GSC_DIR = path.join(ROOT, 'docs', 'gsc-raw');
const APPLY = process.argv.includes('--apply');
const REFRESH = process.argv.includes('--refresh');
const SAMPLE_LIMIT = 20;
const EXCLUDE_LOCALE_RE = /\.(en|zh|es|vi|th|uz)\.md$/;
const TOP_LEVEL_KEY_RE = /^[A-Za-z][A-Za-z0-9_-]*:\s*/;

const CATEGORY_TAGS = {
  '지역 가이드': ['지역 녹음실', '서울 녹음실', '스튜디오 방문'],
  '악기 연습': ['음악연습실', '악기 연습', '24시간 연습실'],
  '보컬 가이드': ['보컬 연습', '보컬 레슨', '녹음 준비'],
  '녹음 가이드': ['보컬 녹음', '녹음실 예약', '스튜디오 녹음'],
  '믹싱·마스터링': ['믹싱', '마스터링', '홈레코딩'],
  '음악 비즈니스': ['음악 비즈니스', '음반 제작', '음악 비용'],
  '음악 제작': ['음악 제작', '작곡 편곡', '홈레코딩'],
  '강좌': ['믹싱 강좌', '홈레코딩 강좌', '음악 제작'],
  '후기': ['스튜디오 후기', '녹음 후기', 'Studio NOL'],
  '이벤트': ['스튜디오 이벤트', '뮤지션 모임', 'Studio NOL'],
};

const CATEGORY_LINKS = {
  '지역 가이드': ['guide1', 'pricing1', 'onlinemix1'],
  '악기 연습': ['practice1', 'practice-room-vocal1', 'pricing1'],
  '보컬 가이드': ['lesson1', 'guide1', 'pricing1'],
  '녹음 가이드': ['guide1', 'pricing1', 'vocal-recording-guide1'],
  '믹싱·마스터링': ['mixing1', 'mastering1', 'pricing1'],
  '음악 비즈니스': ['pricing1', 'guide1', 'onlinemix1'],
  '음악 제작': ['producer1', 'guide1', 'pricing1'],
  '강좌': ['mixing1', 'guide1', 'pricing1'],
};

const DEFAULT_LINKS = ['guide1', 'pricing1', 'practice1', 'mixing1', 'onlinemix1'];

const STORY_EXISTS_CACHE = new Set(
  fs.readdirSync(STORIES_DIR)
    .filter((file) => file.endsWith('.md') && !EXCLUDE_LOCALE_RE.test(file))
    .map((file) => file.replace(/\.md$/, ''))
);

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
};

const loadCsv = (filename) => {
  const filePath = path.join(GSC_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
};

const pageMetrics = new Map();
for (const row of loadCsv('page-all.csv')) {
  if (!row.slug) continue;
  pageMetrics.set(row.slug, {
    clicks: Number(row.clicks) || 0,
    impressions: Number(row.impressions) || 0,
    ctr: Number(row.ctr) || 0,
    position: Number(row.position) || 0,
  });
}

const quickWinSlugs = new Set(loadCsv('quick-win.csv').map((row) => row.slug).filter(Boolean));

const queryMetrics = new Map();
for (const row of loadCsv('page-query.csv')) {
  if (!row.slug || !row.query) continue;
  const list = queryMetrics.get(row.slug) || [];
  list.push({
    query: row.query,
    clicks: Number(row.clicks) || 0,
    impressions: Number(row.impressions) || 0,
    position: Number(row.position) || 0,
  });
  queryMetrics.set(row.slug, list);
}

for (const list of queryMetrics.values()) {
  list.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.position - b.position);
}

const removeWrappingQuotes = (value) => {
  const text = String(value || '').trim();
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    return text.slice(1, -1).trim();
  }
  return text;
};

const parseFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { yaml: '', body: content, fm: {}, hasFrontmatter: false };
  }

  const yaml = match[1];
  const body = content.slice(match[0].length);
  const fm = {};

  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  const dateMatch = yaml.match(/^date:\s*(.+)$/m);
  const categoryMatch = yaml.match(/^category:\s*(.+)$/m);
  const robotsMatch = yaml.match(/^robots:\s*(.+)$/m);

  if (titleMatch) fm.title = removeWrappingQuotes(titleMatch[1]);
  if (dateMatch) fm.date = dateMatch[1].trim();
  if (categoryMatch) fm.category = removeWrappingQuotes(categoryMatch[1]);
  if (robotsMatch) fm.robots = removeWrappingQuotes(robotsMatch[1]);

  const summaryBlockMatch = yaml.match(/^summary:\s*(?:>-|>|\|[-+]?)\n((?:  [^\n]*\n?)+)/m);
  if (summaryBlockMatch) {
    fm.summary = summaryBlockMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    const summaryInlineMatch = yaml.match(/^summary:\s*(.+)$/m);
    if (summaryInlineMatch) fm.summary = removeWrappingQuotes(summaryInlineMatch[1]);
  }

  const tagsBlockMatch = yaml.match(/^tags:\n((?:  - [^\n]+\n?)+)/m);
  if (tagsBlockMatch) {
    fm.tags = tagsBlockMatch[1].match(/^  - (.+)$/gm)
      ?.map((line) => removeWrappingQuotes(line.replace(/^  - /, '')))
      .filter(Boolean) || [];
  } else {
    const tagsInlineMatch = yaml.match(/^tags:\s*\[([^\]]*)\]/m);
    fm.tags = tagsInlineMatch
      ? tagsInlineMatch[1].split(',').map(removeWrappingQuotes).filter(Boolean)
      : [];
  }

  const faqMatches = yaml.match(/^  - q:/gm);
  fm.faqCount = faqMatches ? faqMatches.length : 0;

  const ctaMatch = yaml.match(/^cta:\s*(.+)$/m);
  if (ctaMatch) fm.cta = removeWrappingQuotes(ctaMatch[1]).toLowerCase();

  return { yaml, body, fm, hasFrontmatter: true, fullMatch: match[0] };
};

const stripMarkdownSyntax = (text) =>
  text
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

const getViolationKeys = (content) => {
  const { fm, body } = parseFrontmatter(content);
  const violations = [];
  const wordCount = stripMarkdownSyntax(body).split(/\s+/).filter(Boolean).length;
  const shortcodeBonus = [...body.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, match) => sum + ({ 'online-fallback': 25, 'session-checklist': 60 }[match[1]] ?? 15), 0);

  if (wordCount + shortcodeBonus < 200) violations.push('word_count');
  if (!fm.title) violations.push('title_missing');
  if (!fm.date) violations.push('date_missing');
  if (!fm.category) violations.push('category_missing');
  if (!fm.summary) violations.push('summary_missing');
  if (!fm.tags || fm.tags.length < 3) violations.push('tags_short');
  if (!fm.faqCount || fm.faqCount < 2) violations.push('faq_short');
  if (fm.title && fm.title.length < 20) violations.push('title_short');
  if (fm.summary && fm.summary.length < 50) violations.push('summary_short');
  if (fm.cta !== undefined && !['recording', 'lesson', 'practice', 'production'].includes(fm.cta)) {
    violations.push('cta_invalid');
  }
  const internalLinks = [...body.matchAll(/\[([^\]]*)\]\(\/stories\/([\w-]+[\w\d]*)\)/g)];
  if (internalLinks.length === 0) violations.push('internal_link_missing');

  return violations;
};

const classifyTier = (slug, fm) => {
  const metric = pageMetrics.get(slug) || { clicks: 0, impressions: 0 };
  if (fm.robots && /noindex/i.test(fm.robots)) return 'C';
  if (metric.clicks >= 1 || metric.impressions >= 50 || quickWinSlugs.has(slug)) return 'A';
  if (metric.impressions >= 10) return 'B';
  return 'C';
};

const titleCore = (title) =>
  removeWrappingQuotes(title)
    .replace(/\s*\|\s*.+$/, '')
    .split('—')[0]
    .replace(/([^\d])\s*[:：]\s+.*$/, '$1')
    .trim();

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const smartTrim = (value, maxLength = 155) => {
  const text = compactText(value);
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength);
  const lastStop = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('다.'), sliced.lastIndexOf('요.'));
  if (lastStop >= 80) return sliced.slice(0, lastStop + 1).trim();
  return sliced.replace(/[,\s·-]+[^\s,·-]*$/, '').trim();
};

const topicFromTitleAndQuery = (slug, fm) => {
  const titleTopic = titleCore(fm.title || slug)
    .replace(/\s+완전\s*가이드$/, '')
    .replace(/\s+vs$/i, '')
    .trim();
  const query = (queryMetrics.get(slug) || []).find((item) => isUsefulQueryTag(item.query))?.query;
  if (!query) return titleTopic;
  if (/[A-Za-z]/.test(query) && /[가-힣]/.test(titleTopic)) return titleTopic;
  if (query.length < 4 && titleTopic) return titleTopic;
  return query;
};

const detectRegionName = (title, slug) => {
  const fromTitle = title.match(/^(.+?)에서\s+서울/)?.[1]
    || title.match(/^(.+?)\s+음악연습실/)?.[1]
    || title.match(/^(.+?)\s+녹음실/)?.[1];
  if (fromTitle) return fromTitle.trim();
  const parts = slug.replace(/^practice-room-/, '').replace(/\d+$/, '').split('-');
  return parts[0] ? parts[0] : '';
};

const detectInstrument = (slug, title) => {
  const lower = `${slug} ${title}`.toLowerCase();
  if (/bass|베이스/.test(lower)) return '베이스';
  if (/drum|드럼|snare|cymbal|rudiment|림샷/.test(lower)) return '드럼';
  if (/guitar|기타|capo|picking|harmonics/.test(lower)) return '기타';
  if (/vocal|보컬|팔세토|딕션|발성|성량/.test(lower)) return '보컬';
  if (/piano|keyboard|피아노|키보드/.test(lower)) return '피아노';
  return '악기';
};

const hasAny = (value, pattern) => pattern.test(value);

const isRecordingRegionTitle = (title) => /녹음실|녹음\s*스튜디오|레코딩\s*스튜디오|스튜디오 방문/.test(title);

const isPracticeRoomRegionTitle = (title) => /음악연습실/.test(title);

const normalizeRegionName = (region) => compactText(region).replace(/\s+근처$/, '').trim();

const buildRecordingRegionSummary = (region, topic) => {
  const origin = normalizeRegionName(region || topic);
  const prefix = origin ? `${origin}에서 ` : '';
  return `${prefix}연신내 Studio NOL까지 녹음실 방문 동선, 당일 세션 준비, 온라인 믹싱 의뢰 방법을 정리합니다. 이동 시간과 파일 준비 기준을 함께 확인하세요.`;
};

const buildSummary = (slug, fm, tier) => {
  const topic = topicFromTitleAndQuery(slug, fm);
  const title = fm.title || slug;
  const category = fm.category || '';
  const region = detectRegionName(title, slug);
  const instrument = detectInstrument(slug, title);
  let summary;

  if (category === '지역 가이드' && /^.+에서\s+서울/.test(title)) {
    summary = `${region}에서 서울 연신내 Studio NOL까지 이동 시간, KTX·SRT 동선, 당일 녹음 예약 준비를 정리합니다. 세션 전 파일 공유와 귀가 일정까지 한 번에 확인하세요.`;
  } else if (category === '지역 가이드' && isRecordingRegionTitle(title)) {
    summary = buildRecordingRegionSummary(region, topic);
  } else if (category === '지역 가이드' && isPracticeRoomRegionTitle(title)) {
    summary = `${region || topic} 음악연습실 선택 기준을 월 36만원, 24시간 이용, 방음 개인실 관점에서 정리합니다. 연신내 Studio NOL 방문 동선과 입주 전 확인할 조건도 함께 봅니다.`;
  } else if (category === '지역 가이드') {
    summary = `${region || topic} 지역에서 Studio NOL 방문 전 이동 시간, 예약 준비, 연습·녹음 목적별 확인할 조건을 정리합니다. 상담 전 확인할 기준도 함께 봅니다.`;
  } else if (category === '악기 연습' && /창업|양도|인수|계약|운영/.test(title)) {
    summary = `${topic} 정보를 비용, 계약 조건, 운영 리스크 기준으로 정리합니다. 방음 시공, 월세 입주 수요, Studio NOL 운영 경험에서 확인할 체크포인트를 담았습니다.`;
  } else if (category === '악기 연습' && hasAny(title, /예약|처음 이용|이용 가이드|에티켓|주말|월세|시간 대여|입주|활용법|선택|비교|vs|차이/i)) {
    summary = `${topic} 선택 기준을 비용, 이용 시간, 방음, 장비 보관, 예약 절차 관점에서 정리합니다. Studio NOL 방문 전 확인할 조건과 준비물을 함께 봅니다.`;
  } else if (category === '악기 연습' && hasAny(title, /오디션|버스킹|경연|대회|가요제|공연|발표회|축가|이벤트|기념일|라이브|포트폴리오|영상|스트리밍|콘텐츠|합주|앙상블|리허설/i)) {
    summary = `${topic} 관련 준비를 목표 일정, 곡 준비, 리허설 루틴, 녹음 피드백 기준으로 정리합니다. Studio NOL 방음 개인실에서 실전 전 점검할 포인트를 확인하세요.`;
  } else if (category === '악기 연습' && hasAny(title, /어린이|청소년|직장인|주부|육아맘|대학생|성인|취미|교사|강사|커플|연인|가족|입시|음대|실용음악|초보|입문|처음/i)) {
    summary = `${topic}에 맞는 연습 공간 선택과 루틴 설계를 정리합니다. 24시간 방음 개인실에서 시간표, 소음 걱정, 녹음 피드백을 어떻게 활용할지 확인하세요.`;
  } else if (category === '악기 연습' && hasAny(title, /번아웃|슬럼프|집중|목표|동기|멘탈|스트레스|힐링|습관|체력|스태미나|건강|성대|회복/i)) {
    summary = `${topic} 관련 루틴을 연습 지속성, 컨디션 관리, 녹음 피드백 기준으로 정리합니다. 무리하지 않고 다시 연습 흐름을 만드는 방법을 확인하세요.`;
  } else if (category === '악기 연습' && hasAny(title, /레슨|화상|온라인|교재|시범/i)) {
    summary = `${topic}을 레슨 전후 복습, 과제 녹음, 피드백 적용 순서로 정리합니다. Studio NOL 방음 개인실에서 배운 내용을 실제 실력으로 연결하는 법을 봅니다.`;
  } else if (category === '악기 연습') {
    summary = `${topic} 핵심 원리와 단계별 연습법을 정리합니다. ${instrument} 연습실에서 점검할 루틴, 장비 세팅, 녹음 피드백 포인트까지 확인하세요.`;
  } else if (category === '보컬 가이드') {
    summary = `${topic} 정보를 보컬 훈련 순서, 녹음 실수, 피드백 기준으로 정리합니다. 연신내 Studio NOL 레슨·녹음에서 바로 점검할 포인트를 담았습니다.`;
  } else if (category === '녹음 가이드') {
    summary = `${topic} 준비 과정을 녹음 전 준비물, 세션 진행, 결과물 기준으로 정리합니다. 연신내 Studio NOL의 장비와 엔지니어링 관점도 함께 확인하세요.`;
  } else if (category === '믹싱·마스터링' || category === '강좌') {
    summary = `${topic} 설정 기준과 작업 순서를 정리합니다. 홈레코딩에서 바로 적용할 체크포인트와 Studio NOL 믹싱 의뢰 전 준비할 파일까지 확인하세요.`;
  } else if (category === '음악 비즈니스') {
    if (/1:1.*레슨.*(월정액|단건)|월정액.*단건/.test(title)) {
      summary = '1:1 음악 레슨 월정액과 단건 수강 비용 효율을 비교합니다. 회당 비용, 학원 대비 차이, 목표별 선택 기준을 Studio NOL 레슨 구조에 맞춰 정리합니다.';
    } else if (/EPK|프레스킷/i.test(title)) {
      summary = 'EPK 뜻과 만드는 법을 인디 뮤지션 관점에서 정리합니다. 바이오, 프로필 사진, 음원 링크, 공연 이력, 섭외 연락처까지 프레스킷 필수 요소를 확인하세요.';
    } else {
      summary = `${topic} 정보를 비용, 일정, 준비물 기준으로 비교합니다. Studio NOL 상담 전에 예산과 선택 기준, 의뢰 전 확인할 내용을 빠르게 정리하세요.`;
    }
  } else if (category === '음악 제작') {
    summary = `${topic} 과정을 작곡·편곡·녹음 흐름에 맞춰 정리합니다. 홈레코딩에서 적용할 방법과 Studio NOL 제작 상담 전 준비할 내용을 함께 확인하세요.`;
  } else if (category === '후기') {
    summary = `${topic} 사례를 통해 녹음 준비, 세션 진행, 결과물 확인 포인트를 정리합니다. Studio NOL 이용 전 실제 작업 흐름을 미리 확인하세요.`;
  } else {
    summary = `${topic}의 핵심 개념과 실전 체크리스트를 정리합니다. Studio NOL에서 녹음·믹싱·레슨 상담 전 확인할 준비물과 선택 기준을 함께 담았습니다.`;
  }

  return smartTrim(summary, 155);
};

const makeUnique = (items) => {
  const seen = new Set();
  return items
    .map((item) => compactText(item).replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const isUsefulQueryTag = (value) => {
  const text = compactText(value);
  if (text.length < 2 || text.length > 28) return false;
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(text)) return false;
  if (/^(vocal|drum|guitar|bass|piano)\s+[가-힣]/i.test(text)) return false;
  if (/^[\d\s\W_]+$/.test(text)) return false;
  return /[가-힣]{2,}/.test(text) || /[A-Za-z]{3,}/.test(text);
};

const isUsefulTag = (value) => {
  const text = compactText(value);
  if (!text || text.length > 28) return false;
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(text)) return false;
  if (/^(vocal|drum|guitar|bass|piano)\s+[가-힣]/i.test(text)) return false;
  return true;
};

const buildTags = (slug, fm) => {
  const title = fm.title || slug;
  const category = fm.category || '';
  const allowPracticeRoomTags = category === '지역 가이드' || category === '악기 연습';
  const current = Array.isArray(fm.tags)
    ? fm.tags
      .filter(isUsefulTag)
      .filter((tag) => allowPracticeRoomTags || !['24시간 음악연습실', '방음 개인실'].includes(tag))
    : [];
  const region = detectRegionName(title, slug);
  const instrument = detectInstrument(slug, title);
  const queryTags = (queryMetrics.get(slug) || []).map((item) => item.query).filter(isUsefulQueryTag).slice(0, 3);
  const titleTags = titleCore(title)
    .split(/[·,\/()—-]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 18 && isUsefulTag(part));

  const contextual = [];
  if (category === '지역 가이드' && region) {
    contextual.push(`${region} 녹음실`, `${region} 서울 스튜디오`, `${region} 보컬 녹음`);
  }
  if (category === '지역 가이드') {
    contextual.push(`${region || instrument} 음악연습실`, '24시간 음악연습실', '방음 개인실');
  }
  if (category === '악기 연습') contextual.push(`${instrument} 연습`, `${instrument} 연습실`);
  if (category === '보컬 가이드') contextual.push('보컬 트레이닝', '보컬 녹음');
  if (category === '믹싱·마스터링' || category === '강좌') contextual.push('믹싱 강좌', '홈레코딩');
  if (category === '음악 비즈니스') contextual.push('음악 비용', '스튜디오 견적');

  return makeUnique([
    ...current,
    ...queryTags,
    ...contextual,
    ...(CATEGORY_TAGS[category] || []),
    ...titleTags,
  ]).slice(0, 6);
};

const hasTagIssue = (fm) =>
  (fm.tags || []).some((tag) => {
    if (/[ㄱ-ㅎㅏ-ㅣ]/.test(tag) || /^[A-Za-z]+\s+음악연습실$/.test(tag)) return true;
    const allowPracticeRoomTags = fm.category === '지역 가이드' || fm.category === '악기 연습';
    return !allowPracticeRoomTags && ['24시간 음악연습실', '방음 개인실'].includes(tag);
  });

const hasGeneratedFaq = (yaml) =>
  /(가이드|준비)을/.test(yaml)
  || /처음 연습할 때 어디서부터 시작해야 하나요/.test(yaml)
  ||
  [
    'Studio NOL은 시간제 합주실이 아니라 월 입주형 방음 개인실',
    '가능하지만 녹음해 들어보는 과정이 꼭 필요합니다',
    '원본 파일의 게인, 노이즈, 타이밍 정리',
    '예산만 보지 말고 결과물 용도',
    '목표 결과물, 준비된 파일, 필요한 일정',
  ].some((needle) => yaml.includes(needle));

const answerLimit = (answer) => smartTrim(answer, 180);

const extractBodyFaq = (body) => {
  const lines = body.split(/\r?\n/);
  const faqs = [];
  for (let i = 0; i < lines.length; i += 1) {
    const qMatch = lines[i].match(/^\s*\*\*Q\.?\s*(.+?)\*\*\s*$/)
      || lines[i].match(/^\s*Q\.?\s+(.+?)\s*$/);
    if (!qMatch) continue;
    let answer = '';
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j].trim();
      if (!line) continue;
      if (/^\*\*Q\.?|^Q\.?\s+|^#{1,6}\s+/.test(line)) break;
      answer = line.replace(/^A\.?\s*/, '').replace(/^\*\*A\.?\s*/, '').replace(/\*\*$/, '');
      break;
    }
    if (answer) {
      faqs.push({ q: compactText(qMatch[1]), a: answerLimit(stripMarkdownSyntax(answer)) });
    }
    if (faqs.length >= 3) break;
  }
  return faqs;
};

const buildFaq = (slug, fm, body) => {
  const extracted = extractBodyFaq(body);
  if (extracted.length >= 2) return extracted.slice(0, 3);

  const title = fm.title || slug;
  const category = fm.category || '';
  const topic = topicFromTitleAndQuery(slug, fm);
  const region = detectRegionName(title, slug);
  const faqRegion = normalizeRegionName(region || topic);
  const instrument = detectInstrument(slug, title);

  if (category === '지역 가이드' && (/^.+에서\s+서울/.test(title) || isRecordingRegionTitle(title))) {
    return [
      {
        q: `${faqRegion}에서 Studio NOL까지 당일 방문이 가능한가요?`,
        a: answerLimit(`${faqRegion}에서 대중교통이나 차량으로 연신내역까지 이동하면 당일 녹음 세션이 가능합니다. 예약 전 MR과 참고 음원을 먼저 공유하면 현장 시간을 줄일 수 있습니다.`),
      },
      {
        q: `${faqRegion} 뮤지션이 녹음 전에 준비할 것은 무엇인가요?`,
        a: answerLimit('가사, MR 또는 세션 파일, 참고 곡 링크, 원하는 결과물 형식을 미리 보내주세요. 장거리 이동일수록 세션 시작 30분 전 도착해 목을 풀고 모니터 밸런스를 확인하는 것이 좋습니다.'),
      },
      {
        q: `현지에서 녹음한 파일도 믹싱 의뢰할 수 있나요?`,
        a: answerLimit('가능합니다. 드라이 보컬 WAV와 BPM, 키, 참고 곡을 정리해 보내면 Studio NOL에서 믹싱·마스터링 견적과 필요한 추가 녹음 여부를 안내합니다.'),
      },
    ];
  }

  if (category === '지역 가이드' && isPracticeRoomRegionTitle(title)) {
    return [
      {
        q: `${faqRegion} 음악연습실은 월 이용 기준인가요?`,
        a: answerLimit('Studio NOL은 시간제 합주실이 아니라 월 입주형 방음 개인실을 운영합니다. 월 36만원, 보증금 0원, 24시간 이용 기준으로 장기 연습 루틴을 만들기 좋습니다.'),
      },
      {
        q: `방음 개인실을 고를 때 무엇을 확인해야 하나요?`,
        a: answerLimit('실제 볼륨으로 노래하거나 악기를 연주했을 때 외부 소음 민원이 없는지, 밤 시간 이용이 가능한지, 개인 장비 보관과 환기 상태가 안정적인지 확인해야 합니다.'),
      },
      {
        q: `입주 전 방문 상담을 받을 수 있나요?`,
        a: answerLimit('가능합니다. 카카오톡으로 희망 시간과 연습 악기를 알려주시면 공실 여부, 이용 규칙, 방음 상태를 현장에서 확인할 수 있도록 안내합니다.'),
      },
    ];
  }

  if (category === '지역 가이드') {
    return [
      {
        q: `${faqRegion}에서 Studio NOL 방문 전 무엇을 확인해야 하나요?`,
        a: answerLimit('목적이 녹음인지 월 연습실 이용인지 먼저 정하고, 이동 시간, 예약 가능 시간, 파일 준비물 또는 입주 상담 일정을 함께 확인하는 것이 좋습니다.'),
      },
      {
        q: `방문 상담이나 녹음 예약은 어떻게 잡나요?`,
        a: answerLimit('카카오톡으로 희망 날짜, 이용 목적, 준비된 파일이나 악기를 알려주시면 공실 여부와 녹음 가능 시간을 확인해 안내합니다.'),
      },
      {
        q: `온라인으로 먼저 의뢰할 수도 있나요?`,
        a: answerLimit('가능합니다. 녹음 파일, MR, BPM, 키, 참고 곡을 보내면 믹싱·마스터링 견적과 추가 녹음 필요 여부를 먼저 확인할 수 있습니다.'),
      },
    ];
  }

  if (category === '악기 연습') {
    return [
      {
        q: `${topic} 연습은 어떤 순서로 시작하면 좋나요?`,
        a: answerLimit(`처음에는 느린 템포에서 자세와 리듬을 안정화하고, 이후 원곡 템포와 녹음 피드백으로 넘어가는 순서가 좋습니다. ${instrument} 연습은 짧게 반복하고 바로 들어보는 과정이 효과적입니다.`),
      },
      {
        q: `음악연습실에서 ${instrument}을 연습하면 어떤 장점이 있나요?`,
        a: answerLimit('방음 개인실에서는 충분한 볼륨으로 반복 연습할 수 있고, 주변 소음 없이 녹음해 자신의 타이밍과 톤을 바로 확인할 수 있습니다. 24시간 이용이면 고정 루틴도 만들기 쉽습니다.'),
      },
      {
        q: `녹음 피드백은 어떻게 활용하나요?`,
        a: answerLimit('휴대폰이나 간단한 레코더로 연습을 녹음한 뒤 박자, 음정, 다이내믹을 표시하세요. 같은 구간을 다음 세션에서 다시 녹음하면 개선 폭을 객관적으로 확인할 수 있습니다.'),
      },
    ];
  }

  if (category === '보컬 가이드') {
    return [
      {
        q: `${topic} 관련 연습은 혼자 해도 좋아질 수 있나요?`,
        a: answerLimit('가능하지만 녹음해 들어보는 과정이 꼭 필요합니다. 발성, 발음, 호흡 문제는 부를 때보다 재생해서 들을 때 더 잘 보이므로 짧은 구간을 반복 녹음하며 점검하세요.'),
      },
      {
        q: `보컬 레슨이나 녹음 전에 무엇을 준비해야 하나요?`,
        a: answerLimit('연습할 곡, MR, 가사, 어려운 구간 표시, 참고 보컬 링크를 준비하면 좋습니다. Studio NOL에서는 현재 목 상태와 목표에 맞춰 발성·녹음 방향을 함께 정리합니다.'),
      },
      {
        q: `보컬 실수를 줄이는 가장 빠른 방법은 무엇인가요?`,
        a: answerLimit('한 곡을 통째로 반복하기보다 문제가 되는 2-4마디를 나눠 녹음하고 들어보세요. 음정, 딕션, 호흡을 한 번에 고치려 하지 말고 한 요소씩 분리하는 것이 빠릅니다.'),
      },
    ];
  }

  if (category === '믹싱·마스터링' || category === '강좌') {
    return [
      {
        q: `${topic} 작업에서 가장 먼저 확인할 것은 무엇인가요?`,
        a: answerLimit('원본 파일의 게인, 노이즈, 타이밍 정리가 먼저입니다. 믹싱 플러그인보다 소스 정리가 결과를 크게 좌우하므로 드라이 파일과 참고 곡을 함께 비교하세요.'),
      },
      {
        q: `홈레코딩 파일도 믹싱 의뢰할 수 있나요?`,
        a: answerLimit('가능합니다. 트랙별 WAV, BPM, 키, 참고 곡, 원하는 수정 방향을 정리해 보내면 Studio NOL에서 편집 필요 여부와 믹싱·마스터링 견적을 안내합니다.'),
      },
      {
        q: `믹싱 전 파일은 어떻게 정리해야 하나요?`,
        a: answerLimit('모든 트랙은 같은 시작점으로 export하고, 보컬·악기·이펙트 트랙명을 명확히 적어주세요. 튠이나 편집이 끝난 버전과 원본을 함께 보관하면 수정이 쉬워집니다.'),
      },
    ];
  }

  if (category === '음악 비즈니스') {
    if (/EPK|프레스킷/i.test(title)) {
      return [
        {
          q: 'EPK에는 어떤 자료를 넣어야 하나요?',
          a: answerLimit('아티스트 바이오, 고화질 프로필 사진, 대표곡 링크, 공연·발매 이력, SNS와 연락처를 한곳에 정리하세요. 섭외 담당자가 바로 확인할 수 있는 구조가 중요합니다.'),
        },
        {
          q: 'EPK를 만들 때 음원 링크는 어떻게 준비하나요?',
          a: answerLimit('대표곡 3-5곡을 스트리밍 링크나 다운로드 가능한 폴더로 정리하고, 장르와 추천 트랙을 짧게 설명하세요. 공개 전 자료라면 접근 권한과 사용 범위도 함께 적어야 합니다.'),
        },
        {
          q: 'EPK 제작 전에 Studio NOL에서 도움받을 수 있는 것은 무엇인가요?',
          a: answerLimit('보컬 녹음, 데모 정리, 믹싱·마스터링, 프로필용 음원 샘플 제작을 상담할 수 있습니다. 필요한 자료와 일정이 정리되면 프레스킷 완성 속도가 빨라집니다.'),
        },
      ];
    }

    return [
      {
        q: `${topic} 선택에서 가장 중요한 기준은 무엇인가요?`,
        a: answerLimit('예산만 보지 말고 결과물 용도, 일정, 수정 범위, 포함 서비스를 함께 비교해야 합니다. 녹음·믹싱·마스터링 포함 여부에 따라 실제 비용이 달라집니다.'),
      },
      {
        q: `Studio NOL 상담 전 무엇을 보내면 견적이 빨라지나요?`,
        a: answerLimit('곡 수, 데모 또는 MR, 참고 곡, 원하는 납품 일정, 필요한 서비스 범위를 카카오톡으로 보내주세요. 정보가 구체적일수록 비용과 일정 안내가 정확해집니다.'),
      },
      {
        q: `처음 의뢰하는 사람도 진행할 수 있나요?`,
        a: answerLimit('가능합니다. 처음 녹음·발매를 준비하는 경우에도 세션 준비물, 녹음 순서, 후반 작업 범위를 단계별로 안내해 예산 안에서 필요한 작업부터 정리합니다.'),
      },
    ];
  }

  return [
    {
      q: `${topic} 준비는 무엇부터 확인해야 하나요?`,
      a: answerLimit('목표 결과물, 준비된 파일, 필요한 일정, 예산 범위를 먼저 정리하세요. 그 다음 녹음·믹싱·레슨 중 어떤 도움이 필요한지 나누면 상담이 훨씬 빨라집니다.'),
    },
    {
      q: `Studio NOL에서는 어떤 방식으로 진행하나요?`,
      a: answerLimit('카카오톡으로 자료를 먼저 확인한 뒤 일정과 견적을 안내합니다. 현장에서는 엔지니어가 세팅, 녹음, 피드백, 후반 작업 방향을 단계별로 함께 정리합니다.'),
    },
    {
      q: `결과물을 더 좋게 만들려면 무엇을 준비해야 하나요?`,
      a: answerLimit('참고 곡, 가사, MR 또는 세션 파일, 원하는 톤 설명을 준비하세요. 준비물이 명확할수록 녹음 시간은 줄고 결과물 방향은 더 빠르게 맞춰집니다.'),
    },
  ];
};

const formatTagsBlock = (tags) => `tags:\n${tags.map((tag) => `  - ${tag}`).join('\n')}`;

const yamlDoubleQuote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const formatFaqBlock = (faqs) => {
  const lines = ['faq:'];
  for (const item of faqs.slice(0, 3)) {
    lines.push(`  - q: ${yamlDoubleQuote(item.q)}`);
    lines.push('    a: >-');
    lines.push(`      ${compactText(item.a)}`);
  }
  return lines.join('\n');
};

const replaceTopLevelBlock = (yaml, key, replacement) => {
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (start === -1) {
    const summaryIndex = lines.findIndex((line) => /^summary:/.test(line));
    const insertAt = summaryIndex >= 0 ? findTopLevelBlockEnd(lines, summaryIndex) : lines.length;
    lines.splice(insertAt, 0, replacement);
    return lines.join('\n');
  }
  const end = findTopLevelBlockEnd(lines, start);
  lines.splice(start, end - start, replacement);
  return lines.join('\n');
};

const findTopLevelBlockEnd = (lines, start) => {
  let end = start + 1;
  while (end < lines.length) {
    if (TOP_LEVEL_KEY_RE.test(lines[end])) break;
    end += 1;
  }
  return end;
};

const replaceSummary = (yaml, summary) => {
  const block = `summary: >-\n  ${summary}`;
  return replaceTopLevelBlock(yaml, 'summary', block);
};

const chooseInternalLinks = (slug, fm) => {
  const category = fm.category || '';
  const preferred = [...(CATEGORY_LINKS[category] || []), ...DEFAULT_LINKS];
  if ((fm.title || '').includes('축가')) preferred.unshift('wedding-song1');
  if ((fm.title || '').includes('오디오북') || (fm.title || '').includes('나레이션')) preferred.unshift('voice-acting1');
  if ((fm.title || '').includes('K-pop') || (fm.title || '').includes('보컬')) preferred.unshift('vocal-recording-guide1');
  if ((fm.title || '').includes('연습실')) preferred.unshift('practice1');
  if ((fm.title || '').includes('믹싱') || (fm.title || '').includes('마스터링')) preferred.unshift('mixing1');

  return makeUnique(preferred)
    .filter((candidate) => candidate !== slug && STORY_EXISTS_CACHE.has(candidate))
    .slice(0, 2);
};

const linkLabel = (linkSlug) => {
  const labels = {
    pricing1: '보컬 녹음 비용 가이드',
    guide1: '녹음실 첫 방문 체크리스트',
    practice1: '연신내 음악연습실 가이드',
    mixing1: '믹싱 기본 강좌',
    mastering1: '마스터링 가이드',
    onlinemix1: '온라인 믹싱 의뢰 가이드',
    'wedding-song1': '결혼식 축가 녹음 가이드',
    'voice-acting1': '성우·내레이션 녹음 가이드',
    'vocal-recording-guide1': '처음 보컬 녹음하는 법',
    lesson1: '연신내 보컬 레슨 가이드',
    producer1: '음악 프로듀서 가이드',
    'practice-room-vocal1': '보컬 연습실 활용법',
  };
  return labels[linkSlug] || `${linkSlug} 가이드`;
};

const appendInternalLinks = (body, slug, fm) => {
  const links = chooseInternalLinks(slug, fm);
  if (links.length === 0) return body;
  const paragraph = [
    '## 함께 보면 좋은 가이드',
    '',
    `이 주제와 이어지는 준비 과정은 ${links.map((link) => `[${linkLabel(link)}](/stories/${link})`).join('와 ')}에서 더 구체적으로 확인할 수 있습니다.`,
  ].join('\n');
  return `${body.replace(/\s+$/, '')}\n\n${paragraph}\n`;
};

const fixContent = (slug, content) => {
  const parsed = parseFrontmatter(content);
  if (!parsed.hasFrontmatter) return { content, changed: false, changes: [] };

  const beforeViolations = getViolationKeys(content);
  if (beforeViolations.length === 0 && !REFRESH) return { content, changed: false, changes: [] };

  let yaml = parsed.yaml;
  let body = parsed.body;
  const changes = [];
  const tier = classifyTier(slug, parsed.fm);
  const shouldImproveSummary = REFRESH || !parsed.fm.summary || parsed.fm.summary.length < 90;

  if (shouldImproveSummary) {
    const nextSummary = buildSummary(slug, parsed.fm, tier);
    if (nextSummary && nextSummary !== parsed.fm.summary) {
      yaml = replaceSummary(yaml, nextSummary);
      changes.push('summary');
    }
  }

  if (!parsed.fm.tags || parsed.fm.tags.length < 3 || (REFRESH && hasTagIssue(parsed.fm))) {
    const nextTags = buildTags(slug, parsed.fm);
    if (nextTags.length >= 3) {
      yaml = replaceTopLevelBlock(yaml, 'tags', formatTagsBlock(nextTags));
      changes.push('tags');
    }
  }

  if (!parsed.fm.faqCount || parsed.fm.faqCount < 2 || (REFRESH && hasGeneratedFaq(yaml))) {
    const nextFaq = buildFaq(slug, parsed.fm, body);
    if (nextFaq.length >= 2) {
      yaml = replaceTopLevelBlock(yaml, 'faq', formatFaqBlock(nextFaq));
      changes.push('faq');
    }
  }

  if (beforeViolations.includes('internal_link_missing')) {
    body = appendInternalLinks(body, slug, parsed.fm);
    changes.push('internal_links');
  }

  const nextContent = `---\n${yaml.trim()}\n---\n${body}`;
  return {
    content: nextContent,
    changed: nextContent !== content,
    changes,
    tier,
    beforeViolations,
    afterViolations: getViolationKeys(nextContent),
  };
};

const addCounts = (target, keys) => {
  for (const key of keys) target[key] = (target[key] || 0) + 1;
};

const main = () => {
  let files = fs.readdirSync(STORIES_DIR)
    .filter((file) => file.endsWith('.md') && !EXCLUDE_LOCALE_RE.test(file))
    .sort();

  if (REFRESH) {
    files = makeUnique(
      execSync('git diff --name-only -- content/stories', { cwd: ROOT, encoding: 'utf8' })
        .split(/\r?\n/)
        .filter((file) => file.startsWith('content/stories/') && file.endsWith('.md') && !EXCLUDE_LOCALE_RE.test(file))
        .map((file) => path.basename(file))
    ).sort();
  }

  const stats = {
    checked: 0,
    changed: 0,
    beforeViolating: 0,
    afterViolating: 0,
    beforeKeys: {},
    afterKeys: {},
    tiers: { A: 0, B: 0, C: 0 },
    changeTypes: {},
    samples: [],
  };

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const filePath = path.join(STORIES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const before = getViolationKeys(content);
    stats.checked += 1;
    if (before.length > 0) {
      stats.beforeViolating += 1;
      addCounts(stats.beforeKeys, before);
    }

    const result = fixContent(slug, content);
    if (result.changed) {
      stats.changed += 1;
      stats.tiers[result.tier] += 1;
      addCounts(stats.changeTypes, result.changes);
      if (stats.samples.length < SAMPLE_LIMIT) {
        stats.samples.push({
          slug,
          tier: result.tier,
          changes: result.changes.join(','),
          before: result.beforeViolations.join(','),
          after: result.afterViolations.join(',') || 'ok',
        });
      }
      if (APPLY) fs.writeFileSync(filePath, result.content, 'utf8');
    }

    const after = result.changed ? result.afterViolations : before;
    if (after.length > 0) {
      stats.afterViolating += 1;
      addCounts(stats.afterKeys, after);
    }
  }

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Checked Korean story files: ${stats.checked}`);
  console.log(`Changed files: ${stats.changed}`);
  console.log(`Violating files: ${stats.beforeViolating} -> ${stats.afterViolating}`);
  console.log('Before violations:', stats.beforeKeys);
  console.log('After violations:', stats.afterKeys);
  console.log('Changed by tier:', stats.tiers);
  console.log('Change types:', stats.changeTypes);
  console.log('\nSamples:');
  for (const sample of stats.samples) {
    console.log(`  ${sample.slug} [${sample.tier}] ${sample.changes} :: ${sample.before} -> ${sample.after}`);
  }
};

main();
