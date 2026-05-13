// 두 audit snapshot 비교 → 의미있는 변동만 추출 (Smart Daily 이메일 트리거 판단용)

import type { AuditSnapshot, PageEntry, Tier } from './gscAudit';
import { PSEO_CLUSTERS } from './gscAudit';

export interface TierTransition {
  slug: string;
  title: string;
  cluster: string;
  before: Tier;
  after: Tier;
  beforeClicks: number;
  afterClicks: number;
  beforeImpressions: number;
  afterImpressions: number;
}

export interface AuditDiff {
  hasMeaningfulChange: boolean;
  reasons: string[];
  pseo: {
    newNoindexCandidates: TierTransition[];      // 이전엔 KEEP/WATCH였는데 NOINDEX_CANDIDATE로 떨어진 pSEO
    unindexCandidates: TierTransition[];         // 이전엔 NOINDEX였는데 임프 받기 시작한 pSEO (noindex 해제 후보)
    keepToWatch: TierTransition[];               // 클릭 0 됐지만 임프 살아있음
    watchToKeep: TierTransition[];               // 드디어 클릭 받음
    summary: {
      totalKeep: { before: number; after: number };
      totalWatch: { before: number; after: number };
      totalNoindex: { before: number; after: number };
    };
  };
}

function indexBySlug(pages: PageEntry[]): Map<string, PageEntry> {
  return new Map(pages.map((p) => [p.slug, p]));
}

export function diffAudits(prev: AuditSnapshot | null, curr: AuditSnapshot): AuditDiff {
  const reasons: string[] = [];

  // pSEO 페이지만 추출. PSEO_CLUSTERS는 'other' 제외한 ClusterName subset이라 타입 좁힘.
  const isPseo = (cluster: string): boolean => (PSEO_CLUSTERS as ReadonlySet<string>).has(cluster);
  const currPseo = curr.pages.filter((p) => isPseo(p.cluster));
  const prevPseo = prev ? prev.pages.filter((p) => isPseo(p.cluster)) : [];

  const prevBySlug = indexBySlug(prevPseo);

  const newNoindexCandidates: TierTransition[] = [];
  const unindexCandidates: TierTransition[] = [];
  const keepToWatch: TierTransition[] = [];
  const watchToKeep: TierTransition[] = [];

  for (const p of currPseo) {
    const prev = prevBySlug.get(p.slug);
    if (!prev) continue; // 신규 페이지는 이번 라운드엔 무시

    if (prev.tier !== 'NOINDEX_CANDIDATE' && p.tier === 'NOINDEX_CANDIDATE') {
      newNoindexCandidates.push(makeTransition(p, prev));
    } else if (prev.tier === 'NOINDEX_CANDIDATE' && p.tier !== 'NOINDEX_CANDIDATE') {
      unindexCandidates.push(makeTransition(p, prev));
    } else if (prev.tier === 'KEEP' && (p.tier === 'WATCH' || p.tier === 'WATCH_LOW')) {
      keepToWatch.push(makeTransition(p, prev));
    } else if ((prev.tier === 'WATCH' || prev.tier === 'WATCH_LOW') && p.tier === 'KEEP') {
      watchToKeep.push(makeTransition(p, prev));
    }
  }

  // 의미있는 변화 판정 (Smart Daily 이메일 조건)
  if (watchToKeep.length >= 1) reasons.push(`KEEP 승격 ${watchToKeep.length}건`);
  if (unindexCandidates.length >= 1) reasons.push(`noindex 해제 후보 ${unindexCandidates.length}건`);
  if (newNoindexCandidates.length >= 5) reasons.push(`신규 NOINDEX_CANDIDATE ${newNoindexCandidates.length}건 (≥5)`);
  if (keepToWatch.length >= 3) reasons.push(`KEEP→WATCH 하락 ${keepToWatch.length}건 (≥3)`);

  // 클러스터별 합계
  const prevPseoStats = sumPseoTiers(prevPseo);
  const currPseoStats = sumPseoTiers(currPseo);

  return {
    hasMeaningfulChange: reasons.length > 0,
    reasons,
    pseo: {
      newNoindexCandidates,
      unindexCandidates,
      keepToWatch,
      watchToKeep,
      summary: {
        totalKeep: { before: prevPseoStats.keep, after: currPseoStats.keep },
        totalWatch: { before: prevPseoStats.watch + prevPseoStats.watchLow, after: currPseoStats.watch + currPseoStats.watchLow },
        totalNoindex: { before: prevPseoStats.noindex, after: currPseoStats.noindex },
      },
    },
  };
}

function makeTransition(curr: PageEntry, prev: PageEntry): TierTransition {
  return {
    slug: curr.slug,
    title: curr.title,
    cluster: curr.cluster,
    before: prev.tier,
    after: curr.tier,
    beforeClicks: prev.clicks,
    afterClicks: curr.clicks,
    beforeImpressions: prev.impressions,
    afterImpressions: curr.impressions,
  };
}

function sumPseoTiers(pages: PageEntry[]) {
  let keep = 0, watch = 0, watchLow = 0, noindex = 0;
  for (const p of pages) {
    if (p.tier === 'KEEP') keep++;
    else if (p.tier === 'WATCH') watch++;
    else if (p.tier === 'WATCH_LOW') watchLow++;
    else noindex++;
  }
  return { keep, watch, watchLow, noindex };
}

export function formatDiffReport(diff: AuditDiff, currDate: string, isMonthlySummary: boolean): { subject: string; body: string } {
  const s = diff.pseo.summary;
  const delta = (b: number, a: number) => {
    const d = a - b;
    if (d === 0) return '변동 없음';
    return d > 0 ? `+${d}` : `${d}`;
  };

  const subjectKind = isMonthlySummary ? '월간 종합' : '변동 알림';
  const subject = `[Studio NOL SEO] ${subjectKind} — ${currDate}`;

  const lines: string[] = [];
  lines.push(`# Studio NOL pSEO Audit Report (${currDate})`);
  lines.push('');
  lines.push(`## 현재 pSEO 분포`);
  lines.push(`- KEEP: ${s.totalKeep.after} (${delta(s.totalKeep.before, s.totalKeep.after)})`);
  lines.push(`- WATCH 계열: ${s.totalWatch.after} (${delta(s.totalWatch.before, s.totalWatch.after)})`);
  lines.push(`- NOINDEX_CANDIDATE: ${s.totalNoindex.after} (${delta(s.totalNoindex.before, s.totalNoindex.after)})`);
  lines.push('');

  if (diff.reasons.length > 0) {
    lines.push(`## 변동 사유`);
    for (const r of diff.reasons) lines.push(`- ${r}`);
    lines.push('');
  }

  if (diff.pseo.watchToKeep.length > 0) {
    lines.push(`## KEEP 승격 (드디어 클릭 받음)`);
    for (const t of diff.pseo.watchToKeep.slice(0, 10)) {
      lines.push(`- [${t.slug}] ${t.title} — 클릭 ${t.beforeClicks}→${t.afterClicks}, 임프 ${t.beforeImpressions}→${t.afterImpressions}`);
    }
    lines.push('');
  }

  if (diff.pseo.unindexCandidates.length > 0) {
    lines.push(`## noindex 해제 후보 (현재 noindex 처리됐는데 임프 받기 시작)`);
    for (const t of diff.pseo.unindexCandidates.slice(0, 10)) {
      lines.push(`- [${t.slug}] ${t.title} — 임프 ${t.beforeImpressions}→${t.afterImpressions}`);
    }
    lines.push('');
  }

  if (diff.pseo.keepToWatch.length > 0) {
    lines.push(`## KEEP→WATCH 하락 (클릭 0됨, 검토 필요)`);
    for (const t of diff.pseo.keepToWatch.slice(0, 10)) {
      lines.push(`- [${t.slug}] ${t.title} — 클릭 ${t.beforeClicks}→0, 임프 ${t.beforeImpressions}→${t.afterImpressions}`);
    }
    lines.push('');
  }

  if (diff.pseo.newNoindexCandidates.length > 0) {
    lines.push(`## 신규 NOINDEX_CANDIDATE (임프 0됨)`);
    for (const t of diff.pseo.newNoindexCandidates.slice(0, 10)) {
      lines.push(`- [${t.slug}] ${t.title} — 임프 ${t.beforeImpressions}→0`);
    }
    if (diff.pseo.newNoindexCandidates.length > 10) {
      lines.push(`  ... 외 ${diff.pseo.newNoindexCandidates.length - 10}건`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('이 리포트는 Smart Daily cron(/api/cron/gsc-audit)이 자동 생성. 90일 GSC 데이터 기준.');

  return { subject, body: lines.join('\n') };
}
