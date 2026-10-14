import type { BusinessProfileView } from '../../../lib/funding/businessProfile';
import { INVOICE_CAPABLE_TAX_TYPE_CODES } from '../../../lib/funding/businessStatus';
import type { BadgeTone } from '../../ui/Badge';

/**
 * 정산 정보 화면(`PayoutSectionForm`)과 편집기 요약(`PayoutSummaryCard`)이 함께 쓰는 국세청 상태 표시.
 * 경고 문구 자체는 `businessStatusWarnings`(lib/funding/businessStatus.ts)가 정본이다 — 여기는 배지 한 줄뿐이다.
 */
export const isBusinessView = (b: BusinessProfileView | null | 'unavailable' | undefined): b is BusinessProfileView =>
  typeof b === 'object' && b !== null;

export const businessStatusBadge = (b: Pick<BusinessProfileView, 'ntsStatus' | 'ntsTaxTypeCode'>): { tone: BadgeTone; label: string } => {
  switch (b.ntsStatus) {
    case 'active':
      return b.ntsTaxTypeCode && !INVOICE_CAPABLE_TAX_TYPE_CODES.includes(b.ntsTaxTypeCode)
        ? { tone: 'warning', label: '과세 유형 확인 필요' }
        : { tone: 'success', label: '정상' };
    case 'suspended':
      return { tone: 'error', label: '휴업' };
    case 'closed':
      return { tone: 'error', label: '폐업' };
    case 'unregistered':
      return { tone: 'error', label: '미등록 번호' };
    default:
      return { tone: 'neutral', label: '미확인' };
  }
};

const KST = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const KST_DATE = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });

/** 서버(SSR)와 브라우저가 같은 글자를 내도록 시간대를 못 박는다 — 안 그러면 수화 불일치가 난다. */
export const formatKstDateTime = (iso: string): string => KST.format(new Date(iso));
export const formatKstDate = (iso: string): string => KST_DATE.format(new Date(iso));
