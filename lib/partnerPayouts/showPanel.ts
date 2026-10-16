import { isMissingTableError } from '../dbErrors';
import { buildShowPayoutPreview, syncShowCancelFees } from './show';
import { serializeShowPayoutPreview, type ShowPayoutPanelState } from './showView';

/**
 * 관리자 공연 상세의 정산 절 데이터 — **이 절만** 실패한다(표 0067이 없으면 `migration`, 그 밖의 오류는 `error`). 공연 화면의 나머지(회차·주문·환불)는 그대로 열려야 한다.
 * 열 때 취소된 회차의 결제 수수료 조정을 맞춘다(멱등) — 회차 취소 직후 조정 생성이 실패했어도 운영자가 화면에서 보는 숫자는 맞는다.
 */
export const loadShowPayoutPanel = async (showId: string, now: Date = new Date()): Promise<ShowPayoutPanelState> => {
  try {
    await syncShowCancelFees(showId);
    const preview = await buildShowPayoutPreview(showId, now);
    if (!preview) return { state: 'error' };
    return { state: 'ok', view: serializeShowPayoutPreview(preview) };
  } catch (error: unknown) {
    if (isMissingTableError(error)) return { state: 'migration' };
    console.error('[admin/shows] 정산 절 조회 실패', error);
    return { state: 'error' };
  }
};
