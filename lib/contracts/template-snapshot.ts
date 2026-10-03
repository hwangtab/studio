import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { contractTemplateSnapshots } from '../../db/schema';

export const hashTemplate = (template: string): string =>
  createHash('sha256').update(template, 'utf8').digest('hex');

/**
 * 계약 본문을 만든 템플릿의 사본을 저장한다(있으면 덮어쓴다 — 초안을 고치면 본문을 다시 만들기 때문).
 *
 * 실패해도 던지지 않는다. 사본은 "서명 때 같은 템플릿을 쓰기" 위한 보강이라, 표가 아직 없는 환경이나
 * 일시적 DB 오류로 계약 생성 자체를 막으면 안 된다. 사본이 없으면 서명은 현재 파일로 되돌아간다.
 * 실패는 로그에 남긴다 — 조용히 보호가 빠지는 것을 운영자가 로그에서라도 볼 수 있어야 한다.
 */
export const saveTemplateSnapshot = async (contractId: string, template: string): Promise<boolean> => {
  try {
    const row = { contractId, template, templateHash: hashTemplate(template) };
    await getDb()
      .insert(contractTemplateSnapshots)
      .values(row)
      .onConflictDoUpdate({
        target: contractTemplateSnapshots.contractId,
        set: { template: row.template, templateHash: row.templateHash },
      });
    return true;
  } catch (error: unknown) {
    console.error(`[contracts/template-snapshot] Failed to save snapshot for ${contractId}:`, error);
    return false;
  }
};

/** 사본이 없거나(옛 계약) 표를 못 읽으면(마이그레이션 전) null — 호출부가 현재 파일로 되돌아간다. */
export const loadTemplateSnapshot = async (contractId: string): Promise<string | null> => {
  try {
    const row = await getDb().query.contractTemplateSnapshots.findFirst({
      where: eq(contractTemplateSnapshots.contractId, contractId),
    });
    return row?.template || null;
  } catch (error: unknown) {
    console.error(`[contracts/template-snapshot] Failed to load snapshot for ${contractId}:`, error);
    return null;
  }
};

export const deleteTemplateSnapshot = async (contractId: string): Promise<void> => {
  try {
    await getDb().delete(contractTemplateSnapshots).where(eq(contractTemplateSnapshots.contractId, contractId));
  } catch (error: unknown) {
    console.error(`[contracts/template-snapshot] Failed to delete snapshot for ${contractId}:`, error);
  }
};
