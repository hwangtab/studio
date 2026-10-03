import type { Contract } from '../../db/schema';
import type { ContractFormValues } from '../../components/admin/ContractForm';

/**
 * 계약 레코드를 작성 폼이 쓰는 문자열 값으로 바꾼다.
 *
 * 수정 화면과 복제 화면이 같은 변환을 쓴다. 한쪽만 필드를 빠뜨리면 그 값이 조용히 초기값으로
 * 돌아가고, 운영자는 자기가 지운 줄 알게 된다.
 */

/** <input type="date">가 읽는 형식. 계약 기간은 UTC 자정 저장이라 그대로 잘라 쓴다. */
export const toDateInputValue = (date: Date | null): string => {
  if (!date) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const parseSpecialTerms = (raw: string | null): { terms: string[]; failed: boolean } => {
  if (!raw) return { terms: [], failed: false };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { terms: [], failed: true };
    return { terms: parsed.filter((t): t is string => typeof t === 'string'), failed: false };
  } catch {
    return { terms: [], failed: true };
  }
};

export const contractToFormValues = (
  contract: Contract,
  options: {
    /**
     * 복제할 때는 기간을 비운다. 새 계약은 새 기간이어야 하고, 옛 날짜가 남아 있으면
     * 고치는 것을 잊은 채 저장하기 쉽다 — 이미 지난 기간의 계약이 발행된다.
     */
    clearPeriod?: boolean;
  } = {},
): { values: ContractFormValues; specialTermsUnreadable: boolean } => {
  const specialTerms = parseSpecialTerms(contract.specialTerms);

  return {
    values: {
      title: contract.title,
      customerName: contract.customerName,
      customerBirthdate: contract.customerBirthdate ?? '',
      customerEmail: contract.customerEmail,
      customerPhone: contract.customerPhone,
      customerAddress: contract.customerAddress ?? '',
      roomNumber: contract.roomNumber,
      roomArea: contract.roomArea ?? '',
      startDate: options.clearPeriod ? '' : toDateInputValue(contract.startDate),
      endDate: options.clearPeriod ? '' : toDateInputValue(contract.endDate),
      monthlyRent: String(contract.monthlyRent),
      depositAmount: String(contract.depositAmount),
      paymentDay: String(contract.paymentDay),
      specialTerms: specialTerms.terms,
    },
    specialTermsUnreadable: specialTerms.failed,
  };
};
