import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { MIXING_PRODUCTS, mixingUnitAmount } from '../../lib/booking/mixing-products';
import { SESSION_PRODUCTS, productHours } from '../../lib/booking/products';
import { VOCAL_TUNING_ADDON_PRICE } from '../../data/pricing';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { lightOnlyField } from '../ui/adminFieldClass';

/**
 * 수기 예약 등록 — 카톡·전화로 받은 예약·믹싱 주문을 운영자가 대신 올린다. 규칙은 lib/booking/manualEntry.ts.
 * 접어 두었다가 필요할 때 연다(예약 목록이 먼저 보여야 한다).
 */

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const sessionProducts = SESSION_PRODUCTS.filter((p) => p.service !== 'smoke-test');

interface Result {
  tone: 'success' | 'error';
  text: string;
  warnings?: string[];
  orderId?: string;
}

/** 캘린더에만 있던 일정을 사이트로 옮길 때 대시보드가 넘기는 값 — 시각을 채우고, 등록이 끝나면 원래 캘린더 일정을 지운다. */
export interface ManualBookingPrefill {
  eventId: string;
  startAt: string;
  endAt: string;
  title: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const ManualBookingPanel = ({
  today,
  onCreated,
  prefill,
}: {
  today: string;
  onCreated: () => Promise<void>;
  prefill?: ManualBookingPrefill | null;
}) => {
  const [open, setOpen] = useState(false);
  const [adoptEventId, setAdoptEventId] = useState<string | null>(null);
  const [adoptWarning, setAdoptWarning] = useState<string | null>(null);
  const [adoptHours, setAdoptHours] = useState<number | null>(null);
  const [kind, setKind] = useState<'session' | 'mixing'>('session');
  const [productId, setProductId] = useState(sessionProducts[0].id);
  const [mixingId, setMixingId] = useState(MIXING_PRODUCTS[0].id);
  const [date, setDate] = useState(today);
  const [startHour, setStartHour] = useState(14);
  const [hours, setHours] = useState(3);
  const [songCount, setSongCount] = useState(1);
  const [vocalTuning, setVocalTuning] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState<'yes' | 'no'>('yes');
  const [method, setMethod] = useState('계좌 입금');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!prefill) return;
    const start = new Date(prefill.startAt);
    const end = new Date(prefill.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const kstStart = new Date(start.getTime() + KST_OFFSET_MS);
    setOpen(true);
    setKind('session');
    setDate(kstStart.toISOString().slice(0, 10));
    setStartHour(kstStart.getUTCHours());
    const eventHours = Math.max(1, Math.round((end.getTime() - start.getTime()) / 3_600_000));
    setHours(eventHours);
    setAdoptHours(eventHours);
    const kstEnd = new Date(end.getTime() + KST_OFFSET_MS);
    const clock = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const original = `${clock(kstStart)}~${clock(kstEnd)}`;
    // 예약은 시 단위다 — 30분 단위 일정은 시작을 내림·길이를 반올림하므로 원본 시각을 메모와 경고에 남긴다.
    const exact = kstStart.getUTCMinutes() === 0 && kstEnd.getUTCMinutes() === 0;
    setNote(exact ? prefill.title : `${prefill.title} (캘린더 원본 ${original})`);
    setAdoptWarning(exact ? null : `캘린더 원본은 ${original}인데 예약은 시 단위라 시작을 ${String(kstStart.getUTCHours()).padStart(2, '0')}:00으로 채웠어요. 시간을 확인해 주세요 — 등록하면 원본 일정은 지워져요.`);
    setAdoptEventId(prefill.eventId);
  }, [prefill]);

  const session = sessionProducts.find((p) => p.id === productId) ?? sessionProducts[0];
  const mixing = MIXING_PRODUCTS.find((p) => p.id === mixingId) ?? MIXING_PRODUCTS[0];
  const { openHour, closeHour } = productHours(session);
  // 캘린더 일정 길이와 고른 상품의 이용 시간이 다르면 알린다 — 패키지는 길이가 고정이고, 시간제는 허용 범위가 있다.
  const lengthWarning = (() => {
    if (!adoptEventId || adoptHours === null || kind !== 'session') return null;
    const { openHour: open, closeHour: close } = productHours(session);
    if (startHour < open || startHour + (session.kind === 'package' ? (session.sessionHours ?? 1) : hours) > close) {
      return `이 상품의 영업시간은 ${open}:00~${close}:00예요. 이 시각으로는 등록되지 않아요.`;
    }
    if (session.kind === 'package' && session.sessionHours !== adoptHours) {
      return `캘린더 일정은 ${adoptHours}시간인데 이 상품은 ${session.sessionHours}시간 패키지예요. 등록하면 ${session.sessionHours}시간으로 잡혀요.`;
    }
    if (session.kind === 'hourly' && (hours < (session.minHours ?? 1) || hours > (session.maxHours ?? 12))) {
      return `캘린더 일정(${adoptHours}시간)은 이 상품의 이용 시간 범위(${session.minHours ?? 1}~${session.maxHours ?? 12}시간) 밖이에요.`;
    }
    return null;
  })();
  const effectiveHours = session.kind === 'package' ? (session.sessionHours ?? 1) : hours;

  const listPrice = useMemo(() => {
    if (kind === 'session') return session.kind === 'package' ? session.unitAmount : session.unitAmount * effectiveHours;
    return mixingUnitAmount(mixing, songCount) * songCount + (vocalTuning && mixing.tuningEligible ? VOCAL_TUNING_ADDON_PRICE * songCount : 0);
  }, [kind, session, mixing, songCount, vocalTuning, effectiveHours]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // "25만"처럼 숫자가 아닌 금액은 NaN → JSON null이 되어 서버가 표기가로 조용히 등록한다. 보내기 전에 막는다.
    const amountText = amount.trim().replace(/,/g, '');
    if (amountText !== '' && !/^\d+$/.test(amountText)) {
      setResult({ tone: 'error', text: '협의 금액은 숫자만 적어 주세요. (예: 250000)' });
      return;
    }
    if (amountText !== '' && Number(amountText) < 1000) {
      setResult({ tone: 'error', text: `금액이 너무 작아요(${Number(amountText).toLocaleString('ko-KR')}원). 원 단위로 적어 주세요. 예: 250000` });
      return;
    }
    setBusy(true);
    setResult(null);
    const body: Record<string, unknown> = {
      kind,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      customerNote: note,
      totalAmount: amountText === '' ? null : Number(amountText),
      received: received === 'yes',
      method,
      ...(kind === 'session' && adoptEventId ? { adoptEventId } : {}),
      ...(kind === 'session'
        ? { productId, date, startHour, ...(session.kind === 'hourly' ? { hours } : {}) }
        : { productId: mixingId, songCount, vocalTuning: vocalTuning && mixing.tuningEligible }),
    };
    try {
      const response = await fetch('/api/admin/bookings/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        setResult({ tone: 'error', text: data?.message || '등록하지 못했습니다.' });
      } else {
        setResult({
          tone: 'success',
          text: data.status === 'paid' ? `${data.orderNo} — 확정으로 등록했습니다.` : `${data.orderNo} — 입금 대기로 시간을 잡았습니다. 돈을 받으면 상세에서 "입금 확인"을 누르세요.`,
          warnings: data.warnings,
          orderId: data.orderId,
        });
        setName('');
        setPhone('');
        setEmail('');
        setAmount('');
        setNote('');
        setAdoptEventId(null);
        setAdoptWarning(null);
        setAdoptHours(null);
        await onCreated();
      }
    } catch {
      setResult({ tone: 'error', text: '네트워크 오류로 등록하지 못했습니다.' });
    }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">수기 예약 등록</h2>
          <p className="text-xs text-gray-500">카톡·전화로 받은 예약이나 믹싱 주문을 대신 올립니다. 웹 예약과 같은 장부에 쌓여 매출 현황에 잡힙니다.</p>
        </div>
        <Button light type="button" variant="weak" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? '접기' : '등록하기'}
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-6">
          {adoptEventId && (
            <div className="md:col-span-6">
              <Notice tone="info">
                구글 캘린더에 있던 일정을 옮기는 중이에요. 등록이 끝나면 원래 캘린더 일정은 지워지고 사이트 예약에서 새로 동기화돼요. 상품·고객·금액을 채워 주세요.
              </Notice>
              {adoptWarning && <Notice tone="warning" className="mt-2">{adoptWarning}</Notice>}
              {lengthWarning && <Notice tone="warning" className="mt-2">{lengthWarning}</Notice>}
            </div>
          )}
          <Field id="mb-kind" label="종류" required className={`md:col-span-2 ${lightOnlyField}`}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as 'session' | 'mixing')} light>
              <option value="session">세션·연습실 예약</option>
              <option value="mixing">믹싱·마스터링 주문</option>
            </Select>
          </Field>

          {kind === 'session' ? (
            <>
              <Field id="mb-product" label="상품" required className={`md:col-span-4 ${lightOnlyField}`}>
                <Select
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    const next = sessionProducts.find((p) => p.id === e.target.value);
                    if (next?.kind === 'hourly') setHours(next.minHours ?? 1);
                    if (next) setStartHour(Math.min(Math.max(startHour, productHours(next).openHour), productHours(next).closeHour - 1));
                  }}
                  light
                >
                  {sessionProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameKo} — {p.kind === 'package' ? `${won(p.unitAmount)} (${p.sessionHours}시간)` : `시간당 ${won(p.unitAmount)}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="mb-date" label="이용 날짜" required hint="지난 날짜도 등록할 수 있어요" className={`md:col-span-2 ${lightOnlyField}`}>
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required light />
              </Field>
              <Field id="mb-start" label="시작 시각" required className={`md:col-span-2 ${lightOnlyField}`}>
                <Select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} light>
                  {Array.from({ length: closeHour - openHour }, (_, i) => openHour + i).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </Select>
              </Field>
              {session.kind === 'hourly' ? (
                <Field id="mb-hours" label="이용 시간" required className={`md:col-span-2 ${lightOnlyField}`}>
                  <Select value={hours} onChange={(e) => setHours(Number(e.target.value))} light>
                    {Array.from({ length: (session.maxHours ?? 12) - (session.minHours ?? 1) + 1 }, (_, i) => (session.minHours ?? 1) + i).map((h) => (
                      <option key={h} value={h}>
                        {h}시간
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <p className="self-end pb-2 text-sm text-gray-600 md:col-span-2">{session.sessionHours}시간 패키지</p>
              )}
            </>
          ) : (
            <>
              <Field id="mb-mixing" label="상품" required className={`md:col-span-4 ${lightOnlyField}`}>
                <Select
                  value={mixingId}
                  onChange={(e) => {
                    setMixingId(e.target.value);
                    const next = MIXING_PRODUCTS.find((p) => p.id === e.target.value);
                    if (next) setSongCount(Math.min(Math.max(songCount, next.minSongs), next.maxSongs));
                  }}
                  light
                >
                  {MIXING_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameKo}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="mb-songs" label="곡 수" required className={`md:col-span-2 ${lightOnlyField}`}>
                <Select value={songCount} onChange={(e) => setSongCount(Number(e.target.value))} light>
                  {Array.from({ length: mixing.maxSongs - mixing.minSongs + 1 }, (_, i) => mixing.minSongs + i).map((n) => (
                    <option key={n} value={n}>
                      {n}곡
                    </option>
                  ))}
                </Select>
              </Field>
              {mixing.tuningEligible && (
                <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-4 md:self-end md:pb-2">
                  <input type="checkbox" className="h-5 w-5 accent-primary" checked={vocalTuning} onChange={(e) => setVocalTuning(e.target.checked)} />
                  보컬 튜닝 포함
                </label>
              )}
            </>
          )}

          <Field id="mb-name" label="고객 이름" required className={`md:col-span-2 ${lightOnlyField}`}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required light />
          </Field>
          <Field id="mb-phone" label="연락처" hint="비워도 됩니다" className={`md:col-span-2 ${lightOnlyField}`}>
            <TextInput inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} light />
          </Field>
          <Field id="mb-email" label="이메일" hint="적으면 확정 메일이 갑니다. 비우면 메일 없이 기록만 합니다." className={`md:col-span-2 ${lightOnlyField}`}>
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} light />
          </Field>

          <Field
            id="mb-amount"
            label="협의 금액 (원)"
            hint={`비우면 표기가 ${won(listPrice)}(부가세 포함)로 등록합니다`}
            className={`md:col-span-2 ${lightOnlyField}`}
          >
            <TextInput inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} placeholder={String(listPrice)} light />
          </Field>
          <Field id="mb-received" label="돈은 받았나요?" required className={`md:col-span-2 ${lightOnlyField}`}>
            <Select value={received} onChange={(e) => setReceived(e.target.value as 'yes' | 'no')} light>
              <option value="yes">이미 받았어요 (확정으로 등록)</option>
              <option value="no">아직이에요 (입금 대기로 시간만 잡기)</option>
            </Select>
          </Field>
          <Field id="mb-method" label="받은 방법" required className={`md:col-span-2 ${lightOnlyField}`}>
            <Select value={method} onChange={(e) => setMethod(e.target.value)} disabled={received === 'no'} light>
              <option value="계좌 입금">계좌 입금</option>
              <option value="현금">현금</option>
            </Select>
          </Field>
          <Field id="mb-note" label="메모" className={`md:col-span-6 ${lightOnlyField}`}>
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} light />
          </Field>

          <div className="md:col-span-6">
            <Button light type="submit" disabled={busy}>
              {busy ? '등록 중…' : '등록하기'}
            </Button>
          </div>
        </form>
      )}

      {result && (
        <Notice tone={result.tone} light className="mt-4">
          {result.text}
          {result.orderId && (
            <>
              {' '}
              <Link href={`/admin/bookings/${result.orderId}`} className="font-medium">
                상세 보기
              </Link>
            </>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </div>
  );
};
