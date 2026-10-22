import React, { useState } from 'react';
import { useRouter } from 'next/router';

import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/Field';
import { lightOnlyField } from '../ui/adminFieldClass';
import { formatCurrency } from '../../lib/contracts/format';
import { formatAdminDate, formatAdminDateTime } from '../../lib/admin/displayDate';
import { adminEventTypesFor, EVENT_SPEC, eventLabelFor, eventStagesFor, isPerSongEvent, STAGE_LABEL } from '../../lib/contracts/production/event-spec';
import type { AdminProgressView, TimelineItem } from '../../lib/contracts/production/progress-view';
import type { ProductionEventType } from '../../db/schema';
import { ActionNotice } from './ActionNotice';
import { useAdminDialog } from './useAdminDialog';

/**
 * 제작 계약 상세의 진행 영역 — 할 일, 대금·일정, 단계별 상태, 해지 시 정산 추정, 기록 추가, 기록 목록.
 *
 * 모든 판정은 서버 장부(ledger.ts)가 했고 이 컴포넌트는 그리기만 한다. 기록 폼의 칸은 EVENT_SPEC 하나에서 나온다
 * (API도 같은 표로 검증한다).
 */

const SEVERITY_CLASS = {
  alert: 'bg-red-50 border-red-200 text-red-800',
  warn: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
} as const;

const NOTICE_LABEL: Record<TimelineItem['noticeStatus'], string> = {
  none: '',
  pending: '통지 대기',
  sent: '통지됨',
  failed: '통지 실패',
};

const post = async (contractId: string, body: Record<string, unknown>) => {
  try {
    const response = await fetch(`/api/contracts/production/${contractId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (response.status === 401) return { ok: false, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
    return { ok: response.ok && result.ok === true, message: result.message };
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' };
  }
};

const actorLabel = (actor: string) =>
  actor === 'client' ? '의뢰인' : actor === 'system' ? '자동' : actor.replace(/^admin:/, '관리자 ');

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-gray-500 shrink-0">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

function RecordForm({
  contractId,
  songLabels,
  mixMaster,
  onDone,
}: {
  contractId: string;
  songLabels: string[];
  /** 믹싱·마스터링 계약 — 편곡·녹음·유통 기록과 단계를 숨기고 이름을 바꾼다(event-spec.ts). */
  mixMaster: boolean;
  onDone: (message: string | null) => Promise<void>;
}) {
  const [type, setType] = useState<ProductionEventType>('payment_received');
  const [stage, setStage] = useState('');
  const [song, setSong] = useState(0);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [cause, setCause] = useState<'client' | 'studio'>('client');
  const [occurredAt, setOccurredAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spec = { ...EVENT_SPEC[type], stages: eventStagesFor(type, mixMaster) };
  // 곡마다 일어나는 기록이고 곡이 둘 이상이면 곡을 고른다(마스터링은 음반 전체라 곡이 없다 — 단계를 고른 뒤에 판정).
  const needsSong = songLabels.length > 1 && isPerSongEvent(type, spec.stages ? stage || null : null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await post(contractId, {
      action: 'record',
      type,
      stage: spec.stages ? stage : undefined,
      song: needsSong ? song : undefined,
      amount: spec.amount ? Number(amount.replace(/[^0-9]/g, '')) : undefined,
      note,
      link: spec.link ? link : undefined,
      cause: spec.cause ? cause : undefined,
      occurredAt,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? '기록하지 못했습니다.');
      return;
    }
    setNote('');
    setLink('');
    setAmount('');
    await onDone(spec.notifies ? '기록했고 의뢰인에게 통지하는 중입니다.' : '기록했습니다.');
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="기록 종류" id="event-type" className={lightOnlyField}>
          <Select light
            id="event-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as ProductionEventType);
              setStage('');
            }}
            className="text-sm"
          >
            {adminEventTypesFor(mixMaster).map((value) => (
              <option key={value} value={value}>
                {eventLabelFor(value, mixMaster)}
              </option>
            ))}
          </Select>
        </Field>
        {spec.stages && (
          <Field label="단계" id="event-stage" className={lightOnlyField}>
            <Select light
              id="event-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="text-sm"
            >
              <option value="">고르기</option>
              {spec.stages.map((value) => (
                <option key={value} value={value}>
                  {STAGE_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {needsSong && (
          <Field label="곡" id="event-song" className={lightOnlyField}>
            <Select light
              id="event-song"
              value={song}
              onChange={(e) => setSong(Number(e.target.value))}
              className="text-sm"
            >
              {songLabels.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {spec.amount && (
          <Field label="금액(원)" id="event-amount" className={lightOnlyField}>
            <TextInput light inputMode="numeric" className="text-sm" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
          </Field>
        )}
        {spec.cause && (
          <Field label="정지 사유" id="event-cause" hint="의뢰인 사유만 작업 기간을 늘립니다(제4조 2항)." className={lightOnlyField}>
            <Select light
              id="event-cause"
              value={cause}
              onChange={(e) => setCause(e.target.value as 'client' | 'studio')}
              className="text-sm"
            >
              <option value="client">의뢰인 사유</option>
              <option value="studio">스튜디오 사유</option>
            </Select>
          </Field>
        )}
        <Field label="일어난 때" id="event-occurred" hint="비우면 지금. 소급 기록은 화면에 표시됩니다." className={lightOnlyField}>
          <TextInput light type="datetime-local" className="text-sm" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </Field>
      </div>
      {spec.link && (
        <Field label="파일 링크" id="event-link" hint="https:// 드라이브 링크. 의뢰인 메일·진행 페이지에 실립니다." className={lightOnlyField}>
          <TextInput light className="text-sm" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
      )}
      {spec.note && (
        <Field
          label={spec.note === 'required' ? '내용 (필수)' : '내용'}
          id="event-note"
          hint={spec.notifies ? '의뢰인 통지 메일에 그대로 실립니다.' : '내부 기록 — 의뢰인에게 보이지 않습니다.'}
          className={lightOnlyField}
        >
          <textarea
            id="event-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900"
          />
        </Field>
      )}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      <Button light type="submit" disabled={busy}>
        {busy ? '기록 중...' : spec.notifies ? '기록하고 의뢰인에게 알리기' : '기록하기'}
      </Button>
    </form>
  );
}

export default function ProductionProgressPanel({
  contractId,
  view,
  editable,
  voidable = editable,
}: {
  contractId: string;
  view: AdminProgressView;
  /** 진행 중(signed)일 때만 기록을 더한다. */
  editable: boolean;
  /** 잘못 넣은 기록을 무효로 할 수 있는가 — 진행 중이거나 해지한 계약(환불 정산을 바로잡는다). */
  voidable?: boolean;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const { ask, dialog } = useAdminDialog();
  const refresh = async (message: string | null) => {
    setNotice(message);
    await router.replace(router.asPath, undefined, { scroll: false });
  };

  const voidEvent = async (item: TimelineItem) => {
    // 서버가 거절하면(사유 누락·환불을 이미 보낸 해지 계약 등) 창을 닫지 않고 그 안에 띄운다.
    const values = await ask({
      title: '기록 무효 처리',
      description: `"${item.label}" 기록을 무효로 합니다. 기록은 지워지지 않고 무효 표시가 남습니다.`,
      fields: [{ name: 'reason', label: '무효 사유', type: 'textarea', required: '무효 사유를 적어 주세요.' }],
      confirmLabel: '무효로 기록',
      tone: 'danger',
      onSubmit: async ({ reason }) => {
        const result = await post(contractId, { action: 'void', eventId: item.id, reason });
        return result.ok ? null : (result.message ?? '처리하지 못했습니다.');
      },
    });
    if (values === null) return;
    await refresh('무효로 기록했습니다.');
  };

  const resendNotice = async (item: TimelineItem) => {
    const result = await post(contractId, { action: 'resend-notice', eventId: item.id });
    await refresh(result.message ?? (result.ok ? '다시 보내는 중입니다.' : '처리하지 못했습니다.'));
  };

  const { payments, work, refund } = view;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
      <div className="p-4 md:p-8 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900 mb-4">진행</h2>
        <ActionNotice message={notice} />

        {view.todos.length > 0 && (
          <ul className="mb-6 space-y-2">
            {view.todos.map((todo) => (
              <li key={todo.message} className={`p-3 border rounded-lg text-sm ${SEVERITY_CLASS[todo.severity]}`}>
                {todo.message}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <dl className="space-y-2">
            <Row label="받은 금액" value={`${formatCurrency(payments.received)}원`} />
            <Row label="받을 금액(추가 포함)" value={`${formatCurrency(payments.totalDue)}원`} />
            <Row label="남은 금액" value={`${formatCurrency(payments.remaining)}원`} />
            <Row
              label="계약금"
              value={
                payments.deposit === 0
                  ? '없음'
                  : payments.depositMetAt
                    ? `입금 ${formatAdminDate(payments.depositMetAt)}`
                    : `기한 ${formatAdminDate(payments.depositLastDay)}`
              }
            />
            <Row label="잔금 기한" value={payments.balanceLastDay ? formatAdminDate(payments.balanceLastDay) : '마스터링 승인 후'} />
          </dl>
          <dl className="space-y-2">
            <Row
              label="작업 기간 시작"
              value={work.startedOn ? formatAdminDate(work.startedOn) : payments.deposit === 0 ? `${view.mixMaster ? '작업 파일' : '1차 완성본'} 대기` : `계약금·${view.mixMaster ? '작업 파일' : '1차 완성본'} 대기`}
            />
            <Row label="완료 예정" value={work.dueOn ? formatAdminDate(work.dueOn) : '-'} />
            <Row label="지연" value={work.delayDays > 0 ? `${work.delayDays}일` : '-'} />
            <Row label="상태" value={work.paused ? '정지 중' : work.finalDeliveredAt ? `최종 인도 ${formatAdminDate(work.finalDeliveredAt)}` : '진행'} />
          </dl>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {view.stages.map((stage) => (
            <div key={`${stage.stage}-${stage.song ?? "album"}`} className="p-3 bg-gray-50 rounded-lg text-sm">
              <p className="font-semibold">{stage.label}</p>
              <p className="text-gray-600">
                전달 {stage.deliveries} · 수정 {stage.revisions} · 무료 남음 {stage.freeRemaining}
                {stage.extraFee > 0 && ` · 추가 ${formatCurrency(stage.extraFee)}원`}
              </p>
              <p className="mt-1">
                {stage.approved
                  ? `승인 ${formatAdminDate(stage.approved.at)} (${stage.approved.mode === 'deemed' ? '기한 경과' : stage.approved.mode === 'explicit' ? '의뢰인' : '대리 기록'})`
                  : stage.pending
                    ? `확인 기한 ${formatAdminDate(stage.pending.lastDayToRespond)}${stage.pending.noticeSent ? '' : ' — 통지 안 됨'}`
                    : stage.revising
                      ? '수정 반영 중'
                      : '대기'}
              </p>
            </div>
          ))}
        </div>

        <details className="mt-6 text-sm">
          <summary className="font-semibold cursor-pointer">지금 해지하면 (제10조 3항 추정)</summary>
          <table className="mt-3 w-full">
            <tbody>
              {refund.lines.map((line) => (
                <tr key={line.key} className="border-b border-gray-100">
                  <td className="py-1.5">{line.label}</td>
                  <td className="py-1.5 text-right text-gray-500">{Math.round(line.ratio * 100)}%</td>
                  <td className="py-1.5 text-right">{formatCurrency(line.deducted)}원</td>
                </tr>
              ))}
              {refund.extras > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-1.5">추가 비용·이행한 초과 수정 (제10조 3항)</td>
                  <td className="py-1.5 text-right text-gray-500">100%</td>
                  <td className="py-1.5 text-right">{formatCurrency(refund.extras)}원</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-2">
            {refund.kickedOff ? '착수 후' : '착수 전 — 받은 금액 전액 환불(제10조 2항)'} · 받은 금액 {formatCurrency(refund.received)}원 − 공제{' '}
            {formatCurrency(refund.deduction)}원 = <strong>환불 {formatCurrency(refund.refundable)}원</strong>
          </p>
          <p className="mt-1 text-gray-500">
            {refund.kickedOff
              ? `스튜디오 사정으로 해지하면(제10조 4항) 추가 비용·초과 수정 요금은 공제하지 않아 환불 ${formatCurrency(refund.refundableIfStudio)}원이에요.`
              : '착수 전에는 해지 사유와 관계없이 받은 금액 전액이에요.'}
          </p>
        </details>
      </div>

      {editable && (
        <div className="p-4 md:p-8 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-900 mb-3">기록 추가</h3>
          <RecordForm contractId={contractId} songLabels={view.songLabels} mixMaster={view.mixMaster} onDone={refresh} />
        </div>
      )}

      <div className="p-4 md:p-8">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-900 mb-3">기록 (최근 순)</h3>
        {view.timeline.length === 0 ? (
          <p className="text-sm text-gray-500">아직 기록이 없습니다.</p>
        ) : (
          <ol className="space-y-2">
            {view.timeline.map((item) => (
              <li key={item.id} className={`p-3 rounded-lg text-sm ${item.voided ? 'bg-gray-50 text-gray-400 line-through' : 'bg-gray-50'}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-gray-500">{formatAdminDateTime(item.occurredAt)}</span>
                  <span className="font-medium">
                    {item.stage ? `${item.stage} ` : ''}
                    {item.label}
                    {item.mode === 'deemed' ? ' (기한 경과)' : item.mode === 'explicit' ? ' (의뢰인)' : ''}
                  </span>
                  {item.amount !== null && <span>{formatCurrency(item.amount)}원</span>}
                  <span className="text-gray-500">{actorLabel(item.actor)}</span>
                  {item.backdated && <span className="text-amber-700">소급</span>}
                  {item.noticeStatus !== 'none' && (
                    <span className={item.noticeStatus === 'failed' ? 'text-red-600' : 'text-gray-500'}>
                      {NOTICE_LABEL[item.noticeStatus]}
                      {item.noticeError ? ` (${item.noticeError})` : ''}
                    </span>
                  )}
                  {voidable && !item.voided && item.type !== 'void' && (
                    <span className="ml-auto flex flex-wrap gap-2">
                      {editable && (item.noticeStatus === 'failed' || item.noticeStatus === 'pending') && (
                        <button type="button" className="text-primary underline" onClick={() => resendNotice(item)}>
                          통지 다시 보내기
                        </button>
                      )}
                      <button type="button" className="text-gray-500 underline" onClick={() => voidEvent(item)}>
                        무효
                      </button>
                    </span>
                  )}
                </div>
                {item.note && <p className="mt-1 whitespace-pre-line text-gray-600">{item.note}</p>}
                {item.link && (
                  <a href={item.link} target="_blank" rel="noreferrer noopener" className="text-primary underline">
                    {item.link}
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      {dialog}
    </div>
  );
}
