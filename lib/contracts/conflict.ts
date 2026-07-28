import type { Contract } from '../../db/schema';

const formatDate = (date: Date): string =>
  date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * 호실 충돌을 관리자가 바로 알아볼 수 있게 설명한다.
 *
 * "이미 계약이 있습니다"만으로는 어느 계약인지 찾아 헤매게 된다. 누구와, 언제까지인지
 * 함께 보여 줘야 취소할지 기간을 조정할지 그 자리에서 판단할 수 있다.
 */
export const describeRoomConflict = (conflict: Contract): string =>
  `${conflict.roomNumber}호는 ${formatDate(conflict.startDate)} ~ ${formatDate(conflict.endDate)} 기간에 ` +
  `이미 계약이 있습니다 (${conflict.customerName}). 기간을 조정하거나 기존 계약을 먼저 취소해 주세요.`;
