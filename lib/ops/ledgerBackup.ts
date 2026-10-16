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
  'orders', 'payments', 'refunds', 'refund_accounts', 'work_orders',
  'funding_pledges', 'funding_pledge_items', 'funding_project_payouts',
  'subscriptions', 'subscription_payments', 'billing_keys',
  'show_orders', 'show_tickets',
  'shop_orders', 'shop_order_items', 'software_orders',
] as const;

/**
 * 백업에 싣지 않는 컬럼 — 자격증명과 상시 토큰. 백업 파일 하나가 새면 결제 수단·관리 링크가 통째로 딸려 나간다.
 * 복구한 뒤에는 어차피 재발급해야 안전하므로 되살릴 이유도 없다(계약 백업이 signToken을 빼는 것과 같은 판단).
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
      if (excluded.length === 0) return row;
      const copy: Record<string, unknown> = { ...row };
      for (const col of excluded) delete copy[col];
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
  const removedBackups = await removeExpiredBackups(now);
  return { backupPath: blob.pathname, rows, missingTables, bytes: body.byteLength, removedBackups };
};

const removeExpiredBackups = async (now: Date): Promise<number> => {
  const boundary = new Date(now.getTime() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  const expired = blobs.filter((b) => new Date(b.uploadedAt) < boundary);
  for (const blob of expired) {
    await del(blob.url).catch((error: unknown) => {
      console.error(`[ledger/backup] 옛 백업 삭제 실패 ${blob.pathname}:`, error);
    });
  }
  return expired.length;
};
