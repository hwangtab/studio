/** @jest-environment node */
import { diffAudits } from './gscDiff';
import type { AuditSnapshot, PageEntry, ClusterName, Tier } from './gscAudit';

// 최소 PageEntry 빌더 — tier는 clicks/impressions에서 유도하지 않고 명시(테스트 의도 고정).
function page(
  slug: string,
  tier: Tier,
  opts: { clicks?: number; impressions?: number; noindex?: boolean; cluster?: ClusterName } = {},
): PageEntry {
  return {
    slug,
    title: slug,
    contentLen: 2000,
    cluster: opts.cluster ?? 'practice-room-station',
    clicks: opts.clicks ?? (tier === 'KEEP' ? 1 : 0),
    impressions: opts.impressions ?? (tier === 'NOINDEX_CANDIDATE' ? 0 : 50),
    tier,
    noindex: opts.noindex ?? false,
  };
}

function snapshot(pages: PageEntry[]): AuditSnapshot {
  return {
    date: '2026-06-30',
    windowDays: 90,
    totalRows: 0,
    uniqueSlugs: pages.length,
    clusters: {} as AuditSnapshot['clusters'],
    pages,
  };
}

describe('diffAudits — noindex 해제 후보 정합 (회귀 가드)', () => {
  it('NOINDEX_CANDIDATE→KEEP(클릭 획득)은 KEEP 승격으로만 분류되고 해제 후보에 중복되지 않는다', () => {
    const prev = snapshot([page('p1', 'NOINDEX_CANDIDATE')]);
    const curr = snapshot([page('p1', 'KEEP', { clicks: 7, impressions: 139, noindex: false })]);

    const diff = diffAudits(prev, curr);

    expect(diff.pseo.watchToKeep.map((t) => t.slug)).toContain('p1');
    expect(diff.pseo.unindexCandidates.map((t) => t.slug)).not.toContain('p1');
  });

  it('이미 색인 중(noindex=false)인데 임프만 생긴 페이지는 해제 후보 거짓양성으로 잡히지 않는다', () => {
    const prev = snapshot([page('p2', 'NOINDEX_CANDIDATE')]);
    const curr = snapshot([page('p2', 'WATCH', { clicks: 0, impressions: 40, noindex: false })]);

    const diff = diffAudits(prev, curr);

    expect(diff.pseo.unindexCandidates.map((t) => t.slug)).not.toContain('p2');
  });

  it('실제 noindex(noindex=true) 페이지가 임프를 받기 시작하면 해제 후보로 보고된다', () => {
    const prev = snapshot([page('p3', 'NOINDEX_CANDIDATE')]);
    const curr = snapshot([page('p3', 'WATCH', { clicks: 0, impressions: 23, noindex: true })]);

    const diff = diffAudits(prev, curr);

    expect(diff.pseo.unindexCandidates.map((t) => t.slug)).toContain('p3');
  });
});
