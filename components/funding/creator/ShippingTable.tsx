import { useState } from 'react';

import type { CreatorShippingRow } from '../../../lib/funding/creatorShipping';
import { FULFILLMENT_LABELS, FULFILLMENT_STATUS_ORDER } from '../../../lib/funding/fulfillmentLabels';
import { Button } from '../../ui/Button';
import { Field, Select, TextInput } from '../../ui/Field';
import { saveFulfillment } from './api';
import { IDLE_SAVE_STATE, type SaveState } from './types';

/**
 * 마감 뒤 배송지 표 — 표시 + 발송 상태·송장 저장.
 *
 * ⚠️ 이 파일은 `lib/funding/creatorShipping.ts`에서 **타입만** 가져온다. 그 모듈은
 * `computeProjectState` 계열을 물고 있는 서버 전용 모듈이라, 컴포넌트가 런타임 값을
 * 하나라도 가져가면 클라이언트 번들에 끌려 들어가 빌드가 깨진다(CLAUDE.md "개설자가 쓴
 * 것은 우리가 쓴 것과 다르게 다룬다" 절, `lib/funding/projects.ts`와 같은 함정). 이 화면을
 * 부르는 GSSP(`pages/[locale]/funding/creator/[id]/shipping.tsx`)만 그 모듈을 값으로 부른다.
 *
 * 발송 상태 라벨은 `lib/funding/fulfillmentLabels.ts`에서 값으로 가져온다 — 그 모듈은
 * `db/schema`·`node:fs`를 물지 않는 순수 상수라 클라이언트 컴포넌트에서 값으로 import해도
 * 안전하다. 관리자 화면(`pages/admin/funding/[id].tsx`)·CSV 내려받기 라우트도 같은 모듈을
 * 쓴다 — 다른 이름을 쓰면 개설자와 운영자가 같은 값을 다른 말로 본다.
 *
 * CSV 내려받기는 일반 링크(`<a href download>`)다 — 같은 출처 GET이고 인증은 쿠키
 * 세션이라 `fetch` + blob으로 우회할 이유가 없다. 서버(`shipping.csv.ts`)가 소유·마감
 * 게이트를 다시 확인하므로 이 버튼은 마감 뒤(rows가 있을 때)에만 보여 준다 — 마감 전에도
 * 눌러 봤자 서버가 409를 주지만, 안내 문구가 이미 마감 전임을 말하고 있어 버튼을 또
 * 보여줄 이유가 없다.
 *

 * 저장 성공/실패는 서버 응답으로만 판단한다. 서버는 소유·마감(closed)·requiresShipping
 * 세 게이트를 다시 확인한다(`lib/funding/creatorShipping.ts`의 `loadFulfillmentGate`) —
 * 이 표가 마감 뒤에만 렌더된다는 사실에 기대지 않는다.
 */

const FULFILLMENT_OPTIONS: readonly string[] = FULFILLMENT_STATUS_ORDER;

const formatAddress = (row: CreatorShippingRow): string => {
  const parts = [row.shippingPostcode, row.shippingAddress1, row.shippingAddress2].filter(
    (v): v is string => typeof v === 'string' && v !== '',
  );
  return parts.length > 0 ? parts.join(' ') : '주소 없음';
};

interface ShippingTableRowProps {
  projectId: string;
  row: CreatorShippingRow;
}

function ShippingTableRow({ projectId, row }: ShippingTableRowProps) {
  const [fulfillmentStatus, setFulfillmentStatus] = useState(row.fulfillmentStatus);
  const [trackingCompany, setTrackingCompany] = useState(row.trackingCompany ?? '');
  const [trackingNumber, setTrackingNumber] = useState(row.trackingNumber ?? '');
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);

  const clearSaveStatus = () => setSave((s) => (s.status === 'idle' ? s : IDLE_SAVE_STATE));

  const submit = async () => {
    setSave({ status: 'saving' });
    const result = await saveFulfillment(projectId, {
      pledgeId: row.pledgeId,
      fulfillmentStatus,
      trackingCompany,
      trackingNumber,
    });
    if (result.ok) {
      setSave({ status: 'success' });
    } else {
      setSave({ status: 'error', message: result.message });
    }
  };

  const rowId = `fulfillment-${row.pledgeId}`;

  return (
    <tr className="border-b border-gray-100 align-top dark:border-gray-800">
      <td className="py-2 pr-4">
        {row.shipHold !== '' && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 typo-caption font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
            {row.shipHold}
          </span>
        )}
      </td>
      <td className="py-2 pr-4">{row.shippingName ?? '이름 없음'}</td>
      <td className="py-2 pr-4">{row.shippingPhone ?? '연락처 없음'}</td>
      <td className="py-2 pr-4">{formatAddress(row)}</td>
      <td className="py-2 pr-4">{row.rewardTitle}</td>
      <td className="py-2 pr-4">{row.quantity}</td>
      <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{row.shippingMemo ?? ''}</td>
      <td className="py-2 pr-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field id={`${rowId}-status`} label="상태" className="w-auto">
            <Select
              value={fulfillmentStatus}
              onChange={(e) => { setFulfillmentStatus(e.target.value); clearSaveStatus(); }}
              className="w-auto text-sm"
            >
              {FULFILLMENT_OPTIONS.map((s) => (
                <option key={s} value={s}>{FULFILLMENT_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
          <Field id={`${rowId}-company`} label="택배사" className="w-auto">
            <TextInput
              value={trackingCompany}
              onChange={(e) => { setTrackingCompany(e.target.value); clearSaveStatus(); }}
              className="w-24 text-sm"
            />
          </Field>
          <Field id={`${rowId}-number`} label="운송장번호" className="w-auto">
            <TextInput
              value={trackingNumber}
              onChange={(e) => { setTrackingNumber(e.target.value); clearSaveStatus(); }}
              className="w-32 text-sm"
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            disabled={save.status === 'saving'}
            onClick={submit}
            className="text-sm"
          >
            저장
          </Button>
        </div>
        {save.status === 'success' && (
          <p className="mt-1 typo-caption text-green-600 dark:text-green-400">저장했습니다.</p>
        )}
        {save.status === 'error' && (
          <p className="mt-1 typo-caption text-red-600 dark:text-red-400">{save.message}</p>
        )}
      </td>
    </tr>
  );
}

interface ShippingTableProps {
  projectId: string;
  rows: CreatorShippingRow[];
}

export function ShippingTable({ projectId, rows }: ShippingTableProps) {
  if (rows.length === 0) {
    return <p className="typo-body text-gray-500 dark:text-gray-400">배송이 필요한 후원이 없습니다.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button asChild variant="secondary" size="sm">
          <a href={`/api/funding/creator/projects/${encodeURIComponent(projectId)}/shipping.csv`} download>
            CSV로 내려받기
          </a>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left typo-body">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {/* 청약철회를 요청했는데 환불이 아직 안 끝난 건 — 관리자 CSV의 shipHold와 같은 판정. */}
              <th className="py-2 pr-4 font-medium">발송 금지</th>
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
              <ShippingTableRow key={row.pledgeId} projectId={projectId} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
