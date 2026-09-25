#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 디지털 전용 후원의 파기 기산점(`funding_pledges.delivered_at`) 백필 — **멱등**이다.
 * `delivered_at IS NULL`인 행만 고르므로 여러 번 돌려도 같은 결과이고, 기산점이 없는
 * 행이 새로 생기면(예: 코드 수정 전에 수기 등록된 디지털 후원) 다시 돌려 복구하면 된다.
 *
 * 왜 필요한가: `delivered_at`을 채우는 코드가 오랫동안 "발송 상태를 손으로 delivered로
 * 바꾸는 경로" 하나뿐이었다(lib/funding/fulfillment.ts). 배송이 없는 리워드는 그 버튼을
 * 누를 실무 계기가 없어서, 디지털 전용 후원의 응원 메시지·admin_memo·배송 필드가 영영
 * 파기되지 않았다 — 약관 제13조와 처리방침 8항이 약속한 "전달 완료 후 1년 파기"가 그
 * 유형에만 구현돼 있지 않았다.
 *
 * 새 후원은 lib/funding/confirm.ts(온라인 확정)와 pages/api/admin/funding/pledges/index.ts
 * (수기 등록)가 확정·등록 시각을 기산점으로 남긴다. 이 스크립트는 그
 * 변경 **이전에** 확정된 행을 같은 규칙으로 채운다: `delivered_at = paid_at`.
 * 확정 순간 내려받기가 열리므로 그때가 전달 완료다.
 *
 * 대상: `requiresShipping: false`인 리워드의 후원 중 `delivered_at IS NULL`이고
 * `paid_at IS NOT NULL`인 행. fulfillment_status는 **건드리지 않는다** —
 * 'delivered'로 바꾸면 assessSelfCancel이 셀프 취소를 막는다.
 *
 * 사용:
 *   node --env-file=.env.local --import tsx scripts/backfill-digital-delivered.mjs
 *   node --env-file=.env.local --import tsx scripts/backfill-digital-delivered.mjs --apply
 *
 * `--apply` 없이는 무엇을 바꿀지만 출력한다(dry-run이 기본).
 * tsx로 실행하는 이유: 프로젝트·리워드 정본을 `lib/funding/repository.ts`(TypeScript)로
 * 읽어야 파일과 DB 양쪽을 같은 규칙으로 보기 때문이다. 여기서 md 파서를 다시 쓰면
 * 그 순간 두 번째 정본이 생긴다.
 */
import { createClient } from '@libsql/client';

import { getAllFundingProjectsAsync } from '../lib/funding/repository';

const APPLY = process.argv.includes('--apply');
const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;

if (!TURSO_DATABASE_URL) {
  console.error('TURSO_DATABASE_URL이 없습니다. --env-file=.env.local 로 실행하세요.');
  process.exit(1);
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

const projects = await getAllFundingProjectsAsync();
/** (slug, rewardId) 쌍 중 배송이 없는 것 — 이 조합의 후원만 대상이다. */
const digital = projects.flatMap((p) =>
  p.rewards.filter((r) => r.requiresShipping === false).map((r) => ({ slug: p.slug, rewardId: r.id })),
);

if (digital.length === 0) {
  console.log('디지털 전용 리워드가 없습니다. 할 일 없음.');
  process.exit(0);
}

let total = 0;
for (const { slug, rewardId } of digital) {
  const rows = await client.execute({
    sql: `SELECT id, paid_at FROM funding_pledges
          WHERE project_slug = ? AND reward_id = ? AND delivered_at IS NULL AND paid_at IS NOT NULL`,
    args: [slug, rewardId],
  });
  if (rows.rows.length === 0) continue;
  total += rows.rows.length;
  console.log(`${slug} / ${rewardId}: ${rows.rows.length}건`);
  if (!APPLY) continue;
  const result = await client.execute({
    sql: `UPDATE funding_pledges SET delivered_at = paid_at, updated_at = unixepoch()
          WHERE project_slug = ? AND reward_id = ? AND delivered_at IS NULL AND paid_at IS NOT NULL`,
    args: [slug, rewardId],
  });
  console.log(`  → ${Number(result.rowsAffected)}건 기록`);
}

console.log(APPLY ? `완료: 대상 ${total}건` : `dry-run: 대상 ${total}건 (--apply 로 실행)`);
client.close();
