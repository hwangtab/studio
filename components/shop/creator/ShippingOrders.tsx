import { useState } from 'react';

import { Badge, type BadgeTone } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field, TextInput } from '../../ui/Field';
import { Notice } from '../../ui/Notice';
import { Panel } from '../../ui/Panel';
import { formatShipsOn } from '../../../lib/shop/preorder';
import type { ArtistShippingRow } from '../../../lib/shop/artistShipping';

/**
 * 발송할 주문 — 아티스트가 직접 보내는 상품의 결제 완료 주문. 받는 분 정보(이름·연락처·주소·메모)는 발송에만 쓴다.
 * 배송 완료 30일 뒤(표시하지 않았으면 발송 60일 뒤)에는 서버가 비워 보낸다(`masked`).
 *
 * ⚠️ `lib/shop/artistShipping.ts`에서 **타입만** 가져온다 — 그 모듈은 서버 전용(DB)이라 값으로 import하면 클라이언트 번들에 끌려 들어온다.
 */

const COURIERS = ['CJ대한통운', '로젠택배', '우체국택배', '한진택배', '롯데택배', '경동택배'] as const;
const STATUS_LABEL: Record<ArtistShippingRow['fulfillmentStatus'], string> = { preparing: '발송 전', shipped: '발송함', delivered: '배송 완료' };
const STATUS_TONE: Record<ArtistShippingRow['fulfillmentStatus'], BadgeTone> = { preparing: 'warning', shipped: 'info', delivered: 'success' };

const kst = (sec: number) => new Date(sec * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const FALLBACK = '연결에 실패했어요. 잠시 후 다시 시도해 주세요.';

async function post(body: Record<string, unknown>): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch('/api/funding/creator/shop/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    return res.ok && data?.ok ? { ok: true } : { ok: false, message: data?.message ?? FALLBACK };
  } catch {
    return { ok: false, message: FALLBACK };
  }
}

function OrderCard({ initial }: { initial: ArtistShippingRow }) {
  const [row, setRow] = useState(initial);
  const [courier, setCourier] = useState(initial.courier ?? '');
  const [tracking, setTracking] = useState(initial.trackingNumber ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const id = `ship-${row.orderNo}`;

  const run = async (action: 'ship' | 'deliver') => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await post({ action, orderNo: row.orderNo, courier, trackingNumber: tracking });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (action === 'ship') {
      setRow((r) => ({ ...r, fulfillmentStatus: r.fulfillmentStatus === 'preparing' ? 'shipped' : r.fulfillmentStatus, courier: courier.trim(), trackingNumber: tracking.trim() }));
      setDone(row.fulfillmentStatus === 'preparing' ? '발송 처리했어요. 주문하신 분께 운송장 번호를 메일로 알렸어요.' : '운송장을 고쳤어요.');
    } else {
      setRow((r) => ({ ...r, fulfillmentStatus: 'delivered' }));
      setDone('배송 완료로 표시했어요.');
    }
  };

  const address = [row.postcode && `(${row.postcode})`, row.address1, row.address2].filter(Boolean).join(' ');

  return (
    <Panel as="section" variant="outline" padding="default" aria-label={`주문 ${row.orderNo}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="typo-body font-semibold text-gray-900 dark:text-white">{row.orderNo}</h2>
        <Badge tone={STATUS_TONE[row.fulfillmentStatus]}>{STATUS_LABEL[row.fulfillmentStatus]}</Badge>
        <span className="typo-caption">{kst(row.orderedAt)} 주문</span>
      </div>

      <ul className="mt-3 space-y-1 typo-body text-gray-800 dark:text-gray-200">
        {row.items.map((it) => (
          <li key={it.label}>
            {it.label} × {it.quantity}
            {it.serials && <span className="ml-2 font-semibold">포장할 번호 {it.serials}</span>}
          </li>
        ))}
      </ul>

      {row.shipsOn && <Notice tone="info" className="mt-3">예약 판매 상품이 있어요. {formatShipsOn(row.shipsOn)} 이후에 보내 주세요.</Notice>}
      {row.partialRefund && <Notice tone="warning" className="mt-3">일부 환불된 주문이에요. 보내기 전에 스튜디오 놀에 확인해 주세요.</Notice>}

      {row.masked ? (
        <p className="mt-3 typo-caption">받는 분 정보는 개인정보 보호를 위해 지워졌어요.</p>
      ) : (
        <dl className="mt-3 grid gap-1 typo-body sm:grid-cols-[6rem_1fr]">
          <dt className="text-gray-500 dark:text-gray-400">받는 분</dt>
          <dd>{row.recipientName} · {row.recipientPhone}</dd>
          <dt className="text-gray-500 dark:text-gray-400">주소</dt>
          <dd>{address}</dd>
          {row.shippingMemo && (<>
            <dt className="text-gray-500 dark:text-gray-400">배송 메모</dt>
            <dd>{row.shippingMemo}</dd>
          </>)}
        </dl>
      )}

      {!row.partialRefund && row.fulfillmentStatus !== 'delivered' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <Field id={`${id}-courier`} label="택배사">
            <TextInput value={courier} onChange={(e) => setCourier(e.target.value)} list={`${id}-couriers`} />
          </Field>
          <Field id={`${id}-tracking`} label="운송장 번호">
            <TextInput value={tracking} onChange={(e) => setTracking(e.target.value)} inputMode="numeric" />
          </Field>
          <Button type="button" disabled={busy || !courier.trim() || !tracking.trim()} onClick={() => run('ship')}>
            {row.fulfillmentStatus === 'preparing' ? '발송 처리' : '운송장 고치기'}
          </Button>
          <datalist id={`${id}-couriers`}>{COURIERS.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      )}
      {row.fulfillmentStatus === 'shipped' && (
        <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={busy} onClick={() => run('deliver')}>배송 완료로 표시</Button>
      )}
      {row.fulfillmentStatus !== 'preparing' && row.trackingNumber && row.fulfillmentStatus === 'delivered' && (
        <p className="mt-3 typo-caption">{row.courier} {row.trackingNumber}</p>
      )}
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      {done && <Notice tone="success" className="mt-3">{done}</Notice>}
    </Panel>
  );
}

export function ShippingOrders({ rows }: { rows: ArtistShippingRow[] }) {
  if (rows.length === 0) return <EmptyState title="발송할 주문이 아직 없어요." />;
  return (
    <div className="space-y-4">
      {rows.map((r) => <OrderCard key={r.orderNo} initial={r} />)}
    </div>
  );
}
