#!/usr/bin/env node
/**
 * 계정 지표를 한 줄로 적재한다 — 최근 7일 합계 + 현재 팔로워.
 *
 *   node --env-file=.env.local scripts/social/insights.mjs            # 출력 + docs/social/insights.csv 추가
 *   node --env-file=.env.local scripts/social/insights.mjs --print    # 출력만
 *
 * 같은 날짜 행이 이미 있으면 덮어쓴다. 집계 수치만 있어 public 저장소에 커밋해도 된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, graph, hintForError } from './meta.mjs';

const CSV = path.join(ROOT, 'docs/social/insights.csv');
const HEADER = 'date,ig_followers,ig_reach_7d,ig_profile_views_7d,ig_engaged_7d,ig_views_7d,th_followers,th_views_7d,th_likes_7d,th_replies_7d,th_reposts_7d,th_quotes_7d';
const printOnly = process.argv.includes('--print');
const since = Math.floor(Date.now() / 1000) - 7 * 86400;
const until = Math.floor(Date.now() / 1000);

const total = (data, name) => {
  const m = data.find((d) => d.name === name);
  if (!m) return '';
  if (m.total_value) return m.total_value.value;
  return (m.values ?? []).reduce((s, v) => s + (v.value ?? 0), 0);
};

async function collect() {
  const igMe = await graph('ig', 'GET', '/me', { fields: 'followers_count' });
  const { data: ig } = await graph('ig', 'GET', '/me/insights', {
    metric: 'reach,profile_views,accounts_engaged,views', period: 'day', metric_type: 'total_value', since, until,
  });
  const { data: th } = await graph('threads', 'GET', '/me/threads_insights', {
    metric: 'views,likes,replies,reposts,quotes,followers_count', since, until,
  });
  return {
    date: new Date().toISOString().slice(0, 10),
    ig_followers: igMe.followers_count,
    ig_reach_7d: total(ig, 'reach'),
    ig_profile_views_7d: total(ig, 'profile_views'),
    ig_engaged_7d: total(ig, 'accounts_engaged'),
    ig_views_7d: total(ig, 'views'),
    th_followers: total(th, 'followers_count'),
    th_views_7d: total(th, 'views'),
    th_likes_7d: total(th, 'likes'),
    th_replies_7d: total(th, 'replies'),
    th_reposts_7d: total(th, 'reposts'),
    th_quotes_7d: total(th, 'quotes'),
  };
}

try {
  const row = await collect();
  console.table(row);
  if (!printOnly) {
    const line = HEADER.split(',').map((k) => row[k]).join(',');
    const lines = fs.existsSync(CSV) ? fs.readFileSync(CSV, 'utf8').trim().split('\n') : [HEADER];
    const kept = lines.filter((l, i) => i === 0 || !l.startsWith(`${row.date},`));
    fs.mkdirSync(path.dirname(CSV), { recursive: true });
    fs.writeFileSync(CSV, `${[...kept, line].join('\n')}\n`);
    console.log(`기록: ${path.relative(ROOT, CSV)}`);
  }
} catch (err) {
  console.error(`실패: ${err.message}`);
  const hint = hintForError(err);
  if (hint) console.error(hint);
  process.exit(1);
}
