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
 * 대상: 담은 리워드가 **전부** `requiresShipping: false`인 후원 중 `delivered_at IS NULL`이고
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

/**
 * 판정은 **후원 단위**다 — 담은 리워드 줄이 전부 디지털일 때만(lib/funding/shape.ts
 * isDigitalOrder와 같은 규칙). 한 주문에 여러 리워드를 담게 된 뒤(마이그레이션 0042) 줄은
 * funding_pledge_items에 있고, 줄이 없는 옛 후원은 funding_pledges의 옛 칸이 곧 한 줄이다
 * (lib/funding/pledgeLinesSql.ts와 같은 UNION ALL 폴백). 예전처럼 `reward_id`(첫 줄 복사본)
 * 하나로 판정하면 "음원 + 책"처럼 첫 줄만 디지털인 주문에도 기산점이 찍혀, 배송 전인
 * 후원의 배송지가 1년 뒤 파기 대상이 된다.
 */
const linesSql = `(
  SELECT i.reward_id AS reward_id FROM funding_pledge_items i WHERE i.pledge_id = fp.id
  UNION ALL
  SELECT fp.reward_id WHERE NOT EXISTS (SELECT 1 FROM funding_pledge_items i0 WHERE i0.pledge_id = fp.id)
)`;

let total = 0;
for (const project of projects) {
  const digitalIds = project.rewards.filter((r) => r.requiresShipping === false).map((r) => r.id);
  if (digitalIds.length === 0) continue;
  const placeholders = digitalIds.map(() => '?').join(', ');
  // "디지털이 아닌 줄이 하나도 없다" — 파일에 없는 리워드 id(삭제·개명)는 배송으로 본다.
  const where = `fp.project_slug = ? AND fp.delivered_at IS NULL AND fp.paid_at IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM ${linesSql} l WHERE l.reward_id NOT IN (${placeholders}))`;
  const args = [project.slug, ...digitalIds];
  const rows = await client.execute({ sql: `SELECT fp.id FROM funding_pledges fp WHERE ${where}`, args });
  if (rows.rows.length === 0) continue;
  total += rows.rows.length;
  console.log(`${project.slug}: ${rows.rows.length}건 (디지털 전용 리워드: ${digitalIds.join(', ')})`);
  if (!APPLY) continue;
  const result = await client.execute({
    sql: `UPDATE funding_pledges SET delivered_at = paid_at, updated_at = unixepoch()
          WHERE id IN (SELECT fp.id FROM funding_pledges fp WHERE ${where})`,
    args,
  });
  console.log(`  → ${Number(result.rowsAffected)}건 기록`);
}

if (total === 0 && !projects.some((p) => p.rewards.some((r) => r.requiresShipping === false))) {
  console.log('디지털 전용 리워드가 없습니다. 할 일 없음.');
}

console.log(APPLY ? `완료: 대상 ${total}건` : `dry-run: 대상 ${total}건 (--apply 로 실행)`);
client.close();
