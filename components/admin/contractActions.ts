/**
 * 관리자 화면에서 공유하는 계약 조작 헬퍼.
 * 목록·상세 양쪽에서 같은 동작을 하므로 한곳에 모은다.
 */

export interface ContractActionResult {
  ok: boolean;
  message?: string;
}

const readMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const result = await response.json();
    return result?.message || fallback;
  } catch {
    return fallback;
  }
};

/** 서명 완료된 계약의 PDF를 내려받는다. */
export const downloadContractPdf = async (
  contractId: string,
  customerName: string,
): Promise<ContractActionResult> => {
  try {
    const response = await fetch(`/api/contracts/${contractId}/pdf`, {
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return { ok: false, message: await readMessage(response, 'PDF를 받을 수 없습니다.') };
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${customerName}_이용계약서.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { ok: true };
  } catch {
    return { ok: false, message: 'PDF 다운로드 중 오류가 발생했습니다.' };
  }
};

export type ContractMutation = 'send' | 'resend' | 'resend-signed' | 'cancel' | 'terminate';

export interface ContractMutationResult extends ContractActionResult {
  /**
   * 처리는 됐지만 사람이 마무리해야 할 것이 남았다는 서버의 경고. terminate에서 연결된 구독
   * 해지·해지 안내 메일이 실패했을 때 온다 — 버리면 비운 방에 청구가 계속되는 것을 아무도 모른다.
   */
  warning?: string;
  /** terminate가 함께 해지한 구독 수. */
  cancelledSubscriptions?: number;
}

export const mutateContract = async (
  contractId: string,
  action: ContractMutation,
  /** terminate에는 종료 사유가 필요하다 — 이 방이 왜 비었는지를 설명하는 유일한 기록이다. */
  payload?: { reason?: string },
): Promise<ContractMutationResult> => {
  try {
    const response = await fetch(`/api/contracts/${contractId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, ...payload }),
    });

    if (!response.ok) {
      return { ok: false, message: await readMessage(response, '요청을 처리하지 못했습니다.') };
    }
    let body: Record<string, unknown> = {};
    try {
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
    } catch {
      // 본문을 못 읽어도 처리 자체는 성공했다(2xx).
    }
    return {
      ok: true,
      ...(typeof body.warning === 'string' && body.warning !== '' ? { warning: body.warning } : {}),
      ...(typeof body.cancelledSubscriptions === 'number'
        ? { cancelledSubscriptions: body.cancelledSubscriptions }
        : {}),
    };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export const deleteContract = async (contractId: string): Promise<ContractActionResult> => {
  try {
    const response = await fetch(`/api/contracts/${contractId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      return { ok: false, message: await readMessage(response, '삭제하지 못했습니다.') };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

export const logoutAdmin = async (): Promise<void> => {
  await fetch('/api/admin/auth', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API가 막힌 환경(비 HTTPS 등) 폴백
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
};
