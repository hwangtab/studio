/**
 * 제작 계약 관리자 화면의 요청 헬퍼. 연습실 contractActions.ts와 같은 형태 — 화면은 ok·message만 본다.
 */
export interface ProductionActionResult {
  ok: boolean;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  /** 생성 성공 시 새 계약 id. */
  id?: string;
}

const BASE = '/api/contracts/production';

const request = async (path: string, init: RequestInit, fallback: string): Promise<ProductionActionResult> => {
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.status === 401) {
      return {
        ok: false,
        message: '로그인이 만료되었습니다. 새 탭에서 /admin/login 으로 다시 로그인한 뒤 다시 눌러 주세요.',
      };
    }
    return {
      ok: response.ok && body.ok === true,
      message: typeof body.message === 'string' ? body.message : response.ok ? undefined : fallback,
      errors: Array.isArray(body.errors) ? (body.errors as ProductionActionResult['errors']) : undefined,
      id:
        body.contract && typeof (body.contract as { id?: unknown }).id === 'string'
          ? (body.contract as { id: string }).id
          : undefined,
    };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export const createProductionContractRequest = (payload: Record<string, unknown>) =>
  request('', { method: 'POST', body: JSON.stringify(payload) }, '계약 생성에 실패했습니다.');

export type ProductionMutation =
  | 'update'
  | 'send'
  | 'resend'
  | 'resend-signed'
  | 'resend-termination'
  | 'cancel'
  | 'complete'
  | 'terminate';

export const mutateProductionContract = (
  contractId: string,
  action: ProductionMutation,
  payload: Record<string, unknown> = {},
) =>
  request(
    `/${contractId}`,
    { method: 'PATCH', body: JSON.stringify({ ...payload, action }) },
    '요청을 처리하지 못했습니다.',
  );

export const deleteProductionContractRequest = (contractId: string) =>
  request(`/${contractId}`, { method: 'DELETE' }, '삭제하지 못했습니다.');

/** 체결된 계약서 PDF를 받아 저장한다(링크로 이동하지 않는다 — 실패가 JSON 흰 화면이 되지 않게). */
export const downloadProductionPdf = async (contractId: string, clientName: string): Promise<ProductionActionResult> => {
  try {
    const response = await fetch(`${BASE}/${contractId}/pdf`, { credentials: 'same-origin' });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      return { ok: false, message: body.message ?? 'PDF를 받을 수 없습니다.' };
    }
    const url = window.URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clientName}_음원제작용역계약서.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, message: 'PDF 다운로드 중 오류가 발생했습니다.' };
  }
};
