import type { CreatorShippingRow } from '../../../lib/funding/creatorShipping';

/**
 * 마감 뒤 배송지 표.
 *
 * ⚠️ 이 파일은 `lib/funding/creatorShipping.ts`에서 **타입만** 가져온다. 그 모듈은
 * `computeProjectState` 계열을 물고 있는 서버 전용 모듈이라, 컴포넌트가 런타임 값을
 * 하나라도 가져가면 클라이언트 번들에 끌려 들어가 빌드가 깨진다(CLAUDE.md "개설자가 쓴
 * 것은 우리가 쓴 것과 다르게 다룬다" 절, `lib/funding/projects.ts`와 같은 함정). 이 화면을
 * 부르는 GSSP(`pages/[locale]/funding/creator/[id]/shipping.tsx`)만 그 모듈을 값으로 부른다.
 *
 * 발송 상태 라벨은 관리자 화면(`pages/admin/funding/[id].tsx`의 `FULFILLMENT_LABELS`)과
 * 같은 한국어 표기를 쓴다 — 다른 이름을 쓰면 개설자와 운영자가 같은 값을 다른 말로 본다.
 * 그 상수는 관리자 페이지 로컬이라 여기서 값으로 import할 수 없어(admin 번들과 얽힌다)
 * 같은 문자열을 그대로 옮겨 둔다.
 *
 * 다음 두 태스크가 이 컴포넌트를 이어서 고친다 — 발송 상태를 여기서 직접 바꾸는 쓰기
 * 폼과, 표 전체를 CSV로 내려받는 버튼이다. 지금은 표시만 하지만 행 단위 렌더를
 * `ShippingTableRow`로 나눠 둬 그 두 기능이 행/헤더 어느 쪽에 붙을지 스스로 고를 수 있게
 * 한다.
 */

const FULFILLMENT_LABELS: Record<string, string> = {
  none: '미발송',
  preparing: '준비중',
  shipped: '발송완료',
  delivered: '수령완료',
};

const formatAddress = (row: CreatorShippingRow): string => {
  const parts = [row.shippingPostcode, row.shippingAddress1, row.shippingAddress2].filter(
    (v): v is string => typeof v === 'string' && v !== '',
  );
  return parts.length > 0 ? parts.join(' ') : '주소 없음';
};

interface ShippingTableProps {
  rows: CreatorShippingRow[];
}

export function ShippingTable({ rows }: ShippingTableProps) {
  if (rows.length === 0) {
    return <p className="typo-body text-gray-500 dark:text-gray-400">배송이 필요한 후원이 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left typo-body">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th className="py-2 pr-4 font-medium">받는 사람</th>
            <th className="py-2 pr-4 font-medium">연락처</th>
            <th className="py-2 pr-4 font-medium">배송지</th>
            <th className="py-2 pr-4 font-medium">리워드</th>
            <th className="py-2 pr-4 font-medium">수량</th>
            <th className="py-2 pr-4 font-medium">메모</th>
            <th className="py-2 pr-4 font-medium">발송 상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.pledgeId} className="border-b border-gray-100 align-top dark:border-gray-800">
              <td className="py-2 pr-4">{row.shippingName ?? '이름 없음'}</td>
              <td className="py-2 pr-4">{row.shippingPhone ?? '연락처 없음'}</td>
              <td className="py-2 pr-4">{formatAddress(row)}</td>
              <td className="py-2 pr-4">{row.rewardTitle}</td>
              <td className="py-2 pr-4">{row.quantity}</td>
              <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{row.shippingMemo ?? ''}</td>
              <td className="py-2 pr-4">
                {FULFILLMENT_LABELS[row.fulfillmentStatus] ?? row.fulfillmentStatus}
                {row.trackingCompany && row.trackingNumber && (
                  <span className="block text-gray-500 dark:text-gray-400">
                    {row.trackingCompany} {row.trackingNumber}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
