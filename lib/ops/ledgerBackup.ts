import { gzipSync } from 'node:zlib';

import { del, list, put } from '@vercel/blob';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';

/**
 * 원장(주문·결제·환불·후원·구독·공연) 일일 백업.
 *
 * 운영 Turso는 starter 플랜이라 시점 복구(PITR)가 **1일**뿐이다. 전자상거래법이 5년 보존을 요구하는
 * 결제·환불 기록이 그 하루짜리 복구 창 하나에 걸려 있었다 — 잘못된 마이그레이션·실수 삭제·토큰 유출을
 * 24시간 안에 알아차리지 못하면 되살릴 근거가 사라진다. 계약 백업(lib/contracts/backup.ts)과 같은 구조로
 * 매일 떠서 private Blob에 두고 28일 뒤 지운다(개인정보가 들어 있어 파기 뒤 사본에 오래 남지 않게).
 *
 * 관계 조회로 JSON을 조립하지 않고 표마다 `SELECT *`를 그대로 뜬다 — 코드가 가장 적고 복구 때 표 단위로
 * 되돌리기 쉽다. 아직 적용되지 않은 마이그레이션의 표는 건너뛰고 결과에 적는다(백업이 그것 때문에 죽지 않게).
 */
export const LEDGER_BACKUP_TABLES = [
  'orders', 'payments', 'refunds', 'refund_accounts', 'work_orders', 'bookings', 'payment_link_orders',
  'funding_pledges', 'funding_pledge_items', 'funding_project_payouts',
  'subscriptions', 'subscription_payments', 'billing_keys', 'room_tenancies', 'room_tenancy_payments', 'artist_payouts',
  'partner_payouts', 'partner_payout_adjustments', 'manual_revenues', 'studio_expenses', 'lesson_enrollments', 'lesson_sessions', 'lesson_payments',
  'show_orders', 'show_order_locales', 'show_tickets',
  'shop_orders', 'shop_order_items', 'software_orders',
] as const;

/**
 * 백업에 싣지 않는 컬럼 — 자격증명과 상시 토큰. 백업 파일 하나가 새면 결제 수단·관리 링크가 통째로 딸려 나간다.
 * 복구한 뒤에는 어차피 재발급해야 안전하므로 되살릴 이유도 없다(계약 백업이 signToken을 빼는 것과 같은 판단).
 *
 * **복구 때 알 것**: 뺀 컬럼(orders.manage_token·subscriptions.manage_token/setup_token/customer_key·show_tickets.code)은
 * NOT NULL UNIQUE라 백업을 그대로 INSERT하면 제약에 걸린다. 복구 스크립트가 새 값을 발급해 채워야 하고, 그러면 고객이
 * 가진 관리 링크·티켓 QR은 전부 무효가 된다(재발송 전제). payments.raw_response는 토스 원문의 `secret`(가상계좌 웹훅
 * 검증값)만 지우고 싣는다.
 */
const EXCLUDED_COLUMNS: Record<string, readonly string[]> = {
  billing_keys: ['billing_key', 'raw_response'],
  subscriptions: ['manage_token', 'setup_token', 'customer_key'],
  orders: ['manage_token'],
  show_tickets: ['code'],
};

const BACKUP_RETENTION_DAYS = 28;
const BACKUP_PREFIX = 'ledger/backup/';

export interface LedgerBackupResult {
  backupPath: string;
  /** 표별 행 수. */
  rows: Record<string, number>;
  /** 운영 DB에 없어 건너뛴 표(미적용 마이그레이션). */
  missingTables: string[];
  bytes: number;
  removedBackups: number;
  /** 28일 지난 백업 중 지우지 못한 수(목록 조회 실패는 1). 0이 아니면 개인정보 사본이 기한을 넘겨 남아 있다. */
  cleanupFailures: number;
}

export const backupLedger = async (now: Date = new Date()): Promise<LedgerBackupResult> => {
  const db = getDb();
  const existing = new Set(
    (await db.all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table'`)).map((r) => r.name),
  );

  const tables: Record<string, Array<Record<string, unknown>>> = {};
  const rows: Record<string, number> = {};
  const missingTables: string[] = [];
  for (const table of LEDGER_BACKUP_TABLES) {
    if (!existing.has(table)) { missingTables.push(table); continue; }
    const excluded = EXCLUDED_COLUMNS[table] ?? [];
    const data = (await db.all<Record<string, unknown>>(sql.raw(`SELECT * FROM ${table}`))).map((row) => {
      const copy: Record<string, unknown> = { ...row };
      for (const col of excluded) delete copy[col];
      if (table === 'payments' && typeof copy.raw_response === 'string') copy.raw_response = stripTossSecret(copy.raw_response);
      return copy;
    });
    tables[table] = data;
    rows[table] = data.length;
  }
  if (missingTables.length > 0) console.error('[ledger/backup] 운영 DB에 없는 표는 건너뜀(미적용 마이그레이션?)', { missingTables });

  const body = gzipSync(Buffer.from(JSON.stringify({ exportedAt: now.toISOString(), excludedColumns: EXCLUDED_COLUMNS, tables })));
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = await put(`${BACKUP_PREFIX}${stamp}.json.gz`, body, {
    access: 'private', contentType: 'application/gzip', addRandomSuffix: false,
  });

  // 새 백업이 써진 뒤에만 오래된 것을 지운다 — 쓰기가 계속 실패하는데 정리만 돌면 28일 뒤 백업이 하나도 안 남는다.
  // 정리 실패는 백업 실패가 아니다 — 여기서 던지면 백업이 써졌는데 "백업 실패" 메일이 나간다. 결과에만 적는다.
  const cleanup = await removeExpiredBackups(now);
  return { backupPath: blob.pathname, rows, missingTables, bytes: body.byteLength, removedBackups: cleanup.removed, cleanupFailures: cleanup.failed };
};

/** 토스 Payment 원문에서 가상계좌 웹훅 검증값(`secret`)만 지운다. 파싱이 안 되면 원문 그대로. */
const stripTossSecret = (raw: string): string => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && 'secret' in parsed) { delete parsed.secret; return JSON.stringify(parsed); }
    return raw;
  } catch {
    return raw;
  }
};

const removeExpiredBackups = async (now: Date): Promise<{ removed: number; failed: number }> => {
  const boundary = new Date(now.getTime() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let blobs: Awaited<ReturnType<typeof list>>['blobs'];
  try {
    ({ blobs } = await list({ prefix: BACKUP_PREFIX }));
  } catch (error: unknown) {
    console.error('[ledger/backup] 옛 백업 목록 조회 실패 — 이번 정리는 건너뜀', error);
    return { removed: 0, failed: 1 };
  }
  const expired = blobs.filter((b) => new Date(b.uploadedAt) < boundary);
  let removed = 0; let failed = 0;
  for (const blob of expired) {
    try { await del(blob.url); removed += 1; } catch (error: unknown) {
      failed += 1;
      console.error(`[ledger/backup] 옛 백업 삭제 실패 ${blob.pathname}:`, error);
    }
  }
  return { removed, failed };
};
