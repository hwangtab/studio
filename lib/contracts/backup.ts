import { del, list, put } from '@vercel/blob';

import { getDb } from '../../db/client';

/**
 * 백업 보관 기간.
 *
 * 복구는 대개 사고 직후에 필요하므로 길게 쌓을 이유가 없다. 백업에는 이름·연락처가
 * 그대로 들어 있어, 오래 두면 계약서 제12조로 약속한 파기가 사본에서 무의미해진다.
 */
const BACKUP_RETENTION_DAYS = 28;

const BACKUP_PREFIX = 'contracts/backup/';
const PDF_PREFIX = 'contracts/';

/**
 * 갓 올라온 PDF를 고아로 오해하지 않기 위한 유예.
 * 서명 직후에는 파일이 먼저 올라가고 DB의 pdfUrl은 그 다음에 기록된다.
 */
const ORPHAN_GRACE_HOURS = 24;

export interface BackupResult {
  backupPath: string;
  contracts: number;
  removedBackups: number;
  removedOrphanPdfs: number;
}

/**
 * 계약 데이터를 통째로 떠서 Blob에 보관하고, 오래된 백업과 주인 없는 PDF를 정리한다.
 *
 * Turso가 유일본이라 DB를 잃으면 어떤 계약이 있었는지조차 알 수 없다. 서명 완료 건은
 * PDF가 남지만 작성 중·서명 대기 계약은 흔적도 남지 않는다.
 */
export const backupContracts = async (now: Date = new Date()): Promise<BackupResult> => {
  const all = await getDb().query.contracts.findMany({
    with: { signatures: true, contractClauses: true, contractAttachments: true },
  });

  // 서명 토큰은 빼고 뜬다. 토큰을 아는 것은 서명 링크를 아는 것과 같아서, 백업 파일 하나가
  // 새면 진행 중인 계약의 링크가 통째로 딸려 나간다. 복구한 뒤에는 어차피 재발송해야
  // 안전하므로(유출 상황일 수 있다) 토큰까지 되살릴 이유가 없다.
  const sanitized = all.map(({ signToken: _signToken, ...rest }) => rest);

  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const blob = await put(
    `${BACKUP_PREFIX}${stamp}.json`,
    JSON.stringify({ exportedAt: now.toISOString(), contracts: sanitized }, null, 2),
    { access: 'private', contentType: 'application/json', addRandomSuffix: false },
  );

  const removedBackups = await removeExpiredBackups(now);
  const removedOrphanPdfs = await removeOrphanPdfs(all, now);

  return {
    backupPath: blob.pathname,
    contracts: all.length,
    removedBackups,
    removedOrphanPdfs,
  };
};

const removeExpiredBackups = async (now: Date): Promise<number> => {
  const boundary = new Date(now.getTime() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { blobs } = await list({ prefix: BACKUP_PREFIX });

  const expired = blobs.filter((b) => new Date(b.uploadedAt) < boundary);
  for (const blob of expired) {
    await del(blob.url).catch((error: unknown) => {
      console.error(`[contracts/backup] Failed to delete old backup ${blob.pathname}:`, error);
    });
  }

  return expired.length;
};

/**
 * 어느 계약도 가리키지 않는 PDF를 지운다.
 *
 * 계약을 지우거나 개인정보를 파기할 때 파일도 함께 지우지만, 그 경로를 거치지 않고
 * 사라진 계약(수동 정리 등)의 파일은 남는다. 남은 파일에는 이름·서명·계약 내용이 그대로
 * 들어 있어, 주인이 없어졌다면 파일도 남아 있을 이유가 없다.
 */
const removeOrphanPdfs = async (
  contracts: ReadonlyArray<{ pdfUrl: string | null }>,
  now: Date,
): Promise<number> => {
  const referenced = new Set(
    contracts.map((c) => c.pdfUrl).filter((url): url is string => Boolean(url)),
  );

  const { blobs } = await list({ prefix: PDF_PREFIX });
  const grace = new Date(now.getTime() - ORPHAN_GRACE_HOURS * 60 * 60 * 1000);

  const orphans = blobs.filter(
    (b) =>
      b.pathname.endsWith('.pdf') &&
      !b.pathname.startsWith(BACKUP_PREFIX) &&
      !referenced.has(b.url) &&
      new Date(b.uploadedAt) < grace,
  );

  for (const blob of orphans) {
    await del(blob.url).catch((error: unknown) => {
      console.error(`[contracts/backup] Failed to delete orphan pdf ${blob.pathname}:`, error);
    });
  }

  return orphans.length;
};
