/**
 * 아무 계정도 참조하지 않는 사업자등록증 파일(`tax-docs/`)을 지운다. `mediaRetention.ts`와 같은 모양이다.
 *
 * 왜 필요한가: 사업자등록증 교체·삭제·사업자 정보 파기는 행을 먼저 바꾸고 Blob은 최선 노력으로 지운다
 * (`deleteTaxDocumentBlob`). 그 삭제가 실패하거나, 업로드 뒤 행 갱신이 실패하면 파일만 남는다.
 *
 * **안전 규칙 — 지우는 쪽으로 실패하지 않는다.**
 * - `tax-docs/` 접두사만 나열하고, 돌아온 항목마다 접두사를 **다시** 확인한다. 이 저장소에는 서명된
 *   계약서 PDF(`contracts/…`)·백업이 함께 있다.
 * - 키가 `tax-docs/<creatorId>/<uuid>.(pdf|webp)` 모양일 때만 지운다(업로드 라우트가 만드는 모양).
 * - 참조 목록을 읽지 못하면(표 없음 포함) 나열도 삭제도 하지 않고 던진다 — 참조를 모른 채 지우면
 *   살아 있는 사업자등록증이 사라진다.
 * - 업로드 뒤 7일이 지나지 않은 파일은 건너뛴다 — 업로드와 행 갱신 사이의 파일을 고아로 오해하지 않는다.
 */
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { TAX_DOCUMENT_PREFIX } from './businessProfile';

/** `mediaRetention.ts`의 유예와 같다. */
const ORPHAN_GRACE_DAYS = 7;

const TAX_DOCUMENT_KEY_PATTERN =
  /^tax-docs\/[A-Za-z0-9_-]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|webp)$/;

interface ListedBlob {
  pathname: string;
  url: string;
  uploadedAt: Date | string;
}

type ListBlobs = (options: { prefix: string; cursor?: string }) => Promise<{
  blobs: ListedBlob[];
  hasMore: boolean;
  cursor?: string;
}>;
type DeleteBlobUrl = (url: string) => Promise<void>;

export interface TaxDocumentPurgeResult {
  scanned: number;
  deleted: number;
  skippedRecent: number;
  failed: number;
}

/** 지연 import — @vercel/blob(undici)은 jsdom 환경에서 import만으로 깨진다(businessProfile.ts와 같다). */
const defaultList: ListBlobs = async (options) => {
  const { list } = await import('@vercel/blob');
  return list(options);
};
const defaultDel: DeleteBlobUrl = async (url) => {
  const { del } = await import('@vercel/blob');
  await del(url);
};

/** 행이 참조하는 사업자등록증 키 전부. 실패는 그대로 던진다. */
const referencedKeys = async (): Promise<Set<string>> => {
  const rows = await getDb().all<{ key: string | null }>(
    sql`select certificate_key as key from creator_business_profiles where certificate_key is not null`,
  );
  return new Set(rows.map((row) => row.key?.trim()).filter((key): key is string => Boolean(key)));
};

export const purgeOrphanTaxDocuments = async (
  deps: { list?: ListBlobs; del?: DeleteBlobUrl; now?: Date } = {},
): Promise<TaxDocumentPurgeResult> => {
  const list = deps.list ?? defaultList;
  const del = deps.del ?? defaultDel;
  const now = deps.now ?? new Date();

  // 참조를 먼저 읽는다 — 실패하면 아무것도 나열하지 않고 끝난다.
  const referenced = await referencedKeys();
  const boundary = new Date(now.getTime() - ORPHAN_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const result: TaxDocumentPurgeResult = { scanned: 0, deleted: 0, skippedRecent: 0, failed: 0 };
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: TAX_DOCUMENT_PREFIX, cursor });
    for (const blob of page.blobs) {
      // 접두사 재확인과 키 모양 검사 — 계약서·다른 파일을 지키는 마지막 방어선이다.
      if (!blob.pathname.startsWith(TAX_DOCUMENT_PREFIX)) continue;
      if (!TAX_DOCUMENT_KEY_PATTERN.test(blob.pathname)) continue;
      result.scanned += 1;

      if (new Date(blob.uploadedAt) >= boundary) {
        result.skippedRecent += 1;
        continue;
      }
      if (referenced.has(blob.pathname)) continue;

      try {
        await del(blob.url);
        result.deleted += 1;
        // 경로는 개설자 id + uuid라 개인정보가 아니다. 무엇이 사라졌는지는 남긴다.
        console.info(`[funding/tax-docs-gc] 고아 사업자등록증 삭제: ${blob.pathname}`);
      } catch (error: unknown) {
        result.failed += 1;
        console.error(`[funding/tax-docs-gc] 삭제 실패 ${blob.pathname}:`, error);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return result;
};
