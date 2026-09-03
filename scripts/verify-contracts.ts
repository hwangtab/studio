/**
 * 서명된 계약의 문서 지문을 일괄 대조한다.
 *
 * 관리자 화면의 감사추적(lib/contracts/audit-trail.ts)은 계약 하나를 열 때마다 대조한다.
 * 이 스크립트는 그것을 세션 없이, 전건에 대해 돌린다 — 분기별 감사, 백업 복구 뒤 무결성
 * 확인, 지문 형식을 바꾼 뒤 옛 계약이 제대로 "검증 불가"로 분류되는지 확인할 때 쓴다.
 * 대조 로직은 audit-trail의 것을 그대로 재사용한다(여기서 새로 계산하지 않는다).
 *
 * PII를 출력하지 않는다 — 계약 id·상태·판정만 찍는다. 화면에 이름이 필요하면 관리자
 * 페이지에서 본다.
 *
 * 실행:
 *   node --env-file=.env.local --import tsx scripts/verify-contracts.ts --all
 *   node --env-file=.env.local --import tsx scripts/verify-contracts.ts <contractId> [...]
 *
 * 종료 코드: mismatch가 하나라도 있으면 1, 아니면 0 (CI·크론에서 그대로 쓸 수 있게).
 */
import { inArray } from 'drizzle-orm';

import { getDb } from '../db/client';
import { contracts } from '../db/schema';
import { buildAuditTrail, type FingerprintVerdict } from '../lib/contracts/audit-trail';

const describe = (verdict: FingerprintVerdict): string => {
  switch (verdict.kind) {
    case 'match':
      return `일치        ${verdict.storedShort}`;
    case 'mismatch':
      return `불일치 ⚠   서명시점 ${verdict.storedShort} / 현재 ${verdict.actualShort}  ← 변조 의심, 확인 필요`;
    case 'purged':
      return `파기됨      ${verdict.storedShort} (대조 안 함 — 정상)`;
    case 'unverifiable':
      return `검증불가    ${verdict.storedShort} (${verdict.reason})`;
    case 'missing':
      return '지문 없음   (지문 도입 이전 계약)';
    case 'unsigned':
      return '서명 전';
  }
};

const main = async (): Promise<number> => {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const ids = args.filter((a) => !a.startsWith('--'));

  if (!all && ids.length === 0) {
    console.error('사용법: verify-contracts.ts --all | <contractId> [...]');
    return 2;
  }

  const db = getDb();
  const rows = await db.query.contracts.findMany({
    where: all ? undefined : inArray(contracts.id, ids),
    with: { signatures: true, contractClauses: true, contractAttachments: true },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  if (rows.length === 0) {
    console.log(all ? '계약이 없습니다.' : '해당 id의 계약이 없습니다.');
    return 0;
  }

  const counts: Record<FingerprintVerdict['kind'], number> = {
    match: 0,
    mismatch: 0,
    purged: 0,
    unverifiable: 0,
    missing: 0,
    unsigned: 0,
  };

  for (const row of rows) {
    const { fingerprint } = buildAuditTrail(row);
    counts[fingerprint.kind] += 1;
    console.log(`${row.id}  [${row.status}]  ${describe(fingerprint)}`);
  }

  console.log('');
  console.log(
    `총 ${rows.length}건 — 일치 ${counts.match} · 불일치 ${counts.mismatch} · 파기 ${counts.purged} · ` +
      `검증불가 ${counts.unverifiable} · 지문없음 ${counts.missing} · 서명전 ${counts.unsigned}`,
  );

  return counts.mismatch > 0 ? 1 : 0;
};

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error('verify-contracts 실패:', error instanceof Error ? error.message : error);
    process.exit(2);
  });
