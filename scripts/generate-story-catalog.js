#!/usr/bin/env node
/* eslint-disable no-console */
// Build-time generator. content/stories/*.md (locale fallback 제외)을 스캔해
// 슬러그·타이틀·content_length·cluster 메타만 추출, lib/story-catalog.json로 저장.
//
// 사용처:
// - pages/api/cron/gsc-audit.ts — Vercel Function이 1,569개 .md 런타임 읽기 안 해도 됨
// - scripts/gsc-pseo-audit.mjs — 로컬 수동 audit도 동일 manifest 사용

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
// 색인 정책의 단일 진실원천(robots:noindex → 광역 허브 예외 → thin 게이트).
// catalog에 noindex 플래그를 박아 gsc-audit이 런타임 .md 재읽기 없이 실제
// 색인 상태를 알 수 있게 한다(diffAudits의 "noindex 해제 후보" 정합).
const { isStoryThin } = require('../lib/sitemap/thinContent');
const { applyFactTokens } = require('../lib/factTokens');

const STORIES_DIR = path.join(process.cwd(), 'content/stories');
const OUTPUT = path.join(process.cwd(), 'lib/story-catalog.json');

function classifyCluster(title) {
  if (/^.+에서 서울 녹음실 방문 가이드/.test(title)) return 'city-ktx-visit';
  if (/구 .+ 녹음실/.test(title) && /연신내/.test(title)) return 'seoul-district-studio';
  if (/음악연습실/.test(title) && /(정거장|월\s*\d+만원)/.test(title)) return 'practice-room-station';
  return 'other';
}

try {
  const files = fs.readdirSync(STORIES_DIR).filter((f) =>
    f.endsWith('.md') && !/\.(en|zh|es|vi|th|uz)\.md$/.test(f)
  );

  const entries = files.map((f) => {
    const raw = applyFactTokens(fs.readFileSync(path.join(STORIES_DIR, f), 'utf-8'));
    const { data, content } = matter(raw);
    const title = data.title || '';
    const slug = f.replace(/\.md$/, '');
    return {
      slug,
      title,
      contentLen: content.length,
      cluster: classifyCluster(title),
      // ko 캐노니컬 페이지가 실제로 noindex(sitemap 제외)인지. 비-ko는 site-wide
      // noindex라 색인 정책 판단 기준이 아니므로 ko 기준으로 고정.
      noindex: isStoryThin(slug, 'ko'),
    };
  });

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2), 'utf-8');

  const byCluster = entries.reduce((acc, e) => { acc[e.cluster] = (acc[e.cluster] || 0) + 1; return acc; }, {});
  console.log(`story-catalog: ${entries.length} entries written to ${path.relative(process.cwd(), OUTPUT)}`);
  for (const [k, v] of Object.entries(byCluster)) console.log(`  ${k}: ${v}`);
} catch (err) {
  console.error('generate-story-catalog failed:', err);
  process.exit(1);
}
