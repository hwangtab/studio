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

interface ClusterTierBreakdown {
  cluster: string;
  count: number;
  keep: number;
  watch: number;
  watchLow: number;
  noindex: number;
  clicks: number;
  impressions: number;
}

function buildClusterBreakdown(snapshot: AuditSnapshot): ClusterTierBreakdown[] {
  const seen = new Map<string, ClusterTierBreakdown>();
  for (const p of snapshot.pages) {
    if (p.cluster === 'other') continue;
    let row = seen.get(p.cluster);
    if (!row) {
      row = { cluster: p.cluster, count: 0, keep: 0, watch: 0, watchLow: 0, noindex: 0, clicks: 0, impressions: 0 };
      seen.set(p.cluster, row);
    }
    row.count++;
    row.clicks += p.clicks;
    row.impressions += p.impressions;
    if (p.tier === 'KEEP') row.keep++;
    else if (p.tier === 'WATCH') row.watch++;
    else if (p.tier === 'WATCH_LOW') row.watchLow++;
    else row.noindex++;
  }
  return [...seen.values()];
}

function topKeepPages(snapshot: AuditSnapshot, limit: number): typeof snapshot.pages {
  return snapshot.pages
    .filter((p) => p.cluster !== 'other' && p.tier === 'KEEP')
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

export function formatDiffReport(
  diff: AuditDiff,
  currDate: string,
  isMonthlySummary: boolean,
  currentSnapshot?: AuditSnapshot,
): { subject: string; body: string } {
  const s = diff.pseo.summary;
  const isBaseline = !currentSnapshot ? false : (s.totalKeep.before === 0 && s.totalWatch.before === 0 && s.totalNoindex.before === 0);
  const delta = (b: number, a: number) => {
    const d = a - b;
    if (d === 0) return '변동 없음';
    return d > 0 ? `+${d}` : `${d}`;
  };

  const subjectKind = isBaseline ? 'Baseline 측정' : isMonthlySummary ? '월간 종합' : '변동 알림';
  const subject = `[Studio NOL SEO] ${subjectKind} — ${currDate}`;

  const lines: string[] = [];
  lines.push(`Studio NOL pSEO Audit Report — ${currDate}`);
  lines.push('==========================================');
  lines.push('');

  // 첫 baseline 안내
  if (isBaseline) {
    lines.push('▶ 첫 baseline 측정입니다. 내일부터 일일 변동 추적이 시작됩니다.');
    lines.push('');
  }

  // Tier 정의
  lines.push('[Tier 정의 — 90일 GSC search analytics 기준]');
  lines.push('  KEEP             클릭 ≥1 (실제 검색 유입 확인됨)');
  lines.push('  WATCH            클릭 0, 임프레션 ≥10 (랭킹 진입 중)');
  lines.push('  WATCH_LOW        클릭 0, 임프레션 1-9 (관찰 단계)');
  lines.push('  NOINDEX_CANDIDATE 클릭 0, 임프레션 0 (검색 노출 0)');
  lines.push('');

  // 전체 분포
  lines.push('[현재 pSEO 분포 — 213개 programmatic landing page 대상]');
  if (isBaseline) {
    lines.push(`  KEEP: ${s.totalKeep.after}`);
    lines.push(`  WATCH 계열: ${s.totalWatch.after} (WATCH+WATCH_LOW 합산)`);
    lines.push(`  NOINDEX_CANDIDATE: ${s.totalNoindex.after} (135건이 robots noindex 적용됨)`);
  } else {
    lines.push(`  KEEP: ${s.totalKeep.after} (${delta(s.totalKeep.before, s.totalKeep.after)})`);
    lines.push(`  WATCH 계열: ${s.totalWatch.after} (${delta(s.totalWatch.before, s.totalWatch.after)})`);
    lines.push(`  NOINDEX_CANDIDATE: ${s.totalNoindex.after} (${delta(s.totalNoindex.before, s.totalNoindex.after)})`);
  }
  lines.push('');

  // 클러스터별 breakdown
  if (currentSnapshot) {
    lines.push('[클러스터별 상세]');
    const breakdown = buildClusterBreakdown(currentSnapshot);
    for (const c of breakdown) {
      const clusterName = c.cluster === 'city-ktx-visit' ? 'KTX 도시→서울 녹음실'
        : c.cluster === 'seoul-district-studio' ? '서울 구·동→연신내'
        : c.cluster === 'practice-room-station' ? '역세권 연습실'
        : c.cluster;
      lines.push(`  ${clusterName} (n=${c.count})`);
      lines.push(`    KEEP=${c.keep}  WATCH=${c.watch}  WATCH_LOW=${c.watchLow}  NOINDEX=${c.noindex}`);
      lines.push(`    90일 클릭=${c.clicks}  임프=${c.impressions}`);
    }
    lines.push('');

    // Top KEEP 페이지
    const top = topKeepPages(currentSnapshot, 10);
    if (top.length > 0) {
      lines.push('[KEEP 페이지 Top 10 — 실제 트래픽 발생 중]');
      for (const p of top) {
        lines.push(`  ${p.clicks.toString().padStart(3)}c / ${p.impressions.toString().padStart(4)}i  ${p.title}`);
      }
      lines.push('');
    }
  }

  // 변동 사유 + 상세 (baseline이 아닐 때만)
  if (!isBaseline) {
    if (diff.reasons.length > 0) {
      lines.push('[변동 사유 — 이메일 발송 트리거]');
      for (const r of diff.reasons) lines.push(`  - ${r}`);
      lines.push('');
    }

    if (diff.pseo.watchToKeep.length > 0) {
      lines.push('[KEEP 승격 — 드디어 클릭 받음 ✓]');
      for (const t of diff.pseo.watchToKeep.slice(0, 10)) {
        lines.push(`  - ${t.title}`);
        lines.push(`    클릭 ${t.beforeClicks}→${t.afterClicks}, 임프 ${t.beforeImpressions}→${t.afterImpressions}`);
      }
      lines.push('');
    }

    if (diff.pseo.unindexCandidates.length > 0) {
      lines.push('[noindex 해제 후보 — 검토 필요]');
      lines.push('  (현재 noindex 처리됐는데 임프 받기 시작 → noindex 풀어볼 가치)');
      for (const t of diff.pseo.unindexCandidates.slice(0, 10)) {
        lines.push(`  - ${t.title}`);
        lines.push(`    임프 ${t.beforeImpressions}→${t.afterImpressions} | slug: ${t.slug}`);
      }
      lines.push('');
    }

    if (diff.pseo.keepToWatch.length > 0) {
      lines.push('[KEEP→WATCH 하락 — 검토 필요]');
      lines.push('  (이전엔 클릭 받던 페이지가 0이 됨)');
      for (const t of diff.pseo.keepToWatch.slice(0, 10)) {
        lines.push(`  - ${t.title}`);
        lines.push(`    클릭 ${t.beforeClicks}→0, 임프 ${t.beforeImpressions}→${t.afterImpressions}`);
      }
      lines.push('');
    }

    if (diff.pseo.newNoindexCandidates.length > 0) {
      lines.push('[신규 NOINDEX_CANDIDATE — 임프 0 떨어진 페이지]');
      for (const t of diff.pseo.newNoindexCandidates.slice(0, 10)) {
        lines.push(`  - ${t.title} (임프 ${t.beforeImpressions}→0)`);
      }
      if (diff.pseo.newNoindexCandidates.length > 10) {
        lines.push(`  ... 외 ${diff.pseo.newNoindexCandidates.length - 10}건`);
      }
      lines.push('');
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('자동 생성: /api/cron/gsc-audit (Vercel Cron, 매일 04:00 KST)');
  lines.push('전체 데이터: docs/gsc-audit-output.csv (수동 audit 실행 시 갱신)');
  lines.push('수동 실행: curl /api/cron/gsc-audit + Bearer CRON_SECRET');

  return { subject, body: lines.join('\n') };
}
