/**
 * 심사 화면(`/admin/funding/projects/[id]`)이 쓰는 조작 헬퍼. `fundingActions.ts`와 같은
 * 얕은 fetch 래퍼 패턴이지만, 판정 API는 성공해도 `warnings`를 실어 보낼 수 있어
 * `FundingActionResult`를 그대로 재사용하지 않고 별도 타입을 둔다 — warnings를 묵살하면
 * 운영자가 "개설자에게 통보됐다"고 착각하게 된다(메일 실패가 조용히 성공으로 보이는 것과
 * 같은 사고).
 */

export interface FundingProjectActionResult {
  ok: boolean;
  message?: string;
  warnings?: string[];
}

const readJson = async (r: Response): Promise<{ message?: string; warnings?: string[] }> => {
  try {
    return await r.json();
  } catch {
    return {};
  }
};

export const patchFundingProject = async (
  id: string,
  body: Record<string, unknown>,
): Promise<FundingProjectActionResult> => {
  try {
    const r = await fetch(`/api/admin/funding/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const result = await readJson(r);
    if (!r.ok) return { ok: false, message: result.message || '처리에 실패했습니다.' };
    return { ok: true, ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}) };
  } catch {
    return { ok: false, message: '네트워크 오류' };
  }
};
