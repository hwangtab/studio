import type { Contract } from '../../db/schema';
import { formatDate } from './format';

/**
 * 호실 충돌을 관리자가 바로 알아볼 수 있게 설명한다.
 *
 * "이미 계약이 있습니다"만으로는 어느 계약인지 찾아 헤매게 된다. 누구와, 언제까지인지
 * 함께 보여 줘야 취소할지 기간을 조정할지 그 자리에서 판단할 수 있다.
 *
 * 안내는 실제로 할 수 있는 조치를 가리켜야 한다. 예전에는 서명된 계약에 대해서도
 * "먼저 취소해 주세요"라고 했는데, 서명된 계약은 취소할 수 없어서(법적 보존) 시키는 대로
 * 해도 아무 버튼이 없었다. 상태에 따라 다른 길을 알려 준다.
 */
export const describeRoomConflict = (conflict: Contract): string => {
  const period = `${formatDate(conflict.startDate)} ~ ${formatDate(conflict.endDate)}`;
  const who = `${conflict.roomNumber}호는 ${period} 기간에 이미 계약이 있습니다 (${conflict.customerName}).`;

  if (conflict.status === 'signed') {
    return (
      `${who} 서명이 끝난 계약이라 취소할 수 없습니다. ` +
      `이용이 이미 끝났다면 그 계약을 열어 "이용 종료 처리"를 한 뒤 다시 시도해 주세요. ` +
      `아직 이용 중이라면 기간이나 호실을 조정해야 합니다.`
    );
  }

  return `${who} 기간을 조정하거나 기존 계약을 먼저 취소해 주세요.`;
};
