import React from 'react';

import type { SerializedAuditTrail } from '../../lib/contracts/audit-trail';

/**
 * 감사추적 — "서명한 적 없다"는 주장에 내놓을 것들.
 *
 * 계약서와 별개 화면이다. 계약서는 당사자가 합의한 내용이고 여기는 그 합의가 어떻게
 * 이루어졌는지에 대한 우리 기록이라, 섞으면 문서 지문에 사후 변동 값이 들어간다
 * (lib/contracts/audit-trail.ts 주석).
 *
 * 관리자 화면 전용이라 라이트 고정이다 — 이 페이지의 다른 절과 같은 규칙이다.
 */

const FINGERPRINT_TONE = {
  match: 'bg-green-50 border-green-200 text-green-900',
  mismatch: 'bg-red-50 border-red-200 text-red-900',
  purged: 'bg-gray-50 border-gray-200 text-gray-700',
  missing: 'bg-amber-50 border-amber-200 text-amber-900',
  unverifiable: 'bg-amber-50 border-amber-200 text-amber-900',
  unsigned: 'bg-gray-50 border-gray-200 text-gray-600',
} as const;

const UNVERIFIABLE_REASON: Record<'unversioned' | 'unknown-version' | 'malformed', string> = {
  unversioned:
    '버전 표기 없이 저장된 옛 형식의 지문이라 어느 방식으로 계산했는지 알 수 없습니다.',
  'unknown-version':
    '이 시스템이 모르는 버전의 지문입니다. 더 새로운 버전으로 만들었거나, 옛 버전 계산 규칙이 제거됐습니다.',
  malformed: '저장된 값이 지문 형식이 아닙니다.',
};

const Fingerprint = ({ verdict }: { verdict: SerializedAuditTrail['fingerprint'] }) => {
  const tone = FINGERPRINT_TONE[verdict.kind];

  return (
    <div className={`rounded-xl border p-4 text-sm ${tone}`}>
      {verdict.kind === 'unsigned' && (
        <p>아직 서명 전이라 대조할 지문이 없습니다.</p>
      )}

      {verdict.kind === 'missing' && (
        <p>
          <strong>지문이 남아 있지 않습니다.</strong> 문서 지문을 도입하기 전에 서명된
          계약입니다. 사후 변조를 이 방법으로는 확인할 수 없습니다.
        </p>
      )}

      {verdict.kind === 'unverifiable' && (
        <>
          <p>
            <strong>이 지문은 다시 계산해 대조할 수 없습니다.</strong>{' '}
            {UNVERIFIABLE_REASON[verdict.reason]} 변조 감지가 아니라 검증 불가입니다 — 서명
            당시 지문이 아래에 남아 있으니 PDF 사본의 값과 눈으로 대조할 수는 있습니다.
          </p>
          <p className="mt-2 font-mono text-xs break-all">
            보관된 지문 {verdict.storedShort} · {verdict.stored}
          </p>
        </>
      )}

      {verdict.kind === 'purged' && (
        <>
          <p>
            <strong>개인정보 파기 후라 대조하지 않습니다.</strong> 본문과 서명 이미지를
            규정대로 지웠기 때문에 다시 계산하면 반드시 어긋납니다. 변조가 아닙니다.
          </p>
          <p className="mt-2 font-mono text-xs break-all">보관된 지문 {verdict.stored}</p>
        </>
      )}

      {verdict.kind === 'match' && (
        <>
          <p>
            <strong>서명 당시 문서와 일치합니다.</strong> 지금 보관 중인 계약 본문·첨부·서명
            이미지·서명자 정보로 다시 계산한 값이 서명 시점에 남긴 지문과 같습니다.
          </p>
          <p className="mt-2 font-mono text-xs break-all">
            SHA-256 {verdict.storedShort} · {verdict.stored}
          </p>
          {verdict.legacyVersion && (
            <p className="mt-2 text-xs">
              버전 표기 없이 저장된 옛 형식({verdict.legacyVersion})의 지문을 그 형식 그대로
              다시 계산해 대조했습니다. 형식만 옛것이고 대조 결과는 확실합니다.
            </p>
          )}
        </>
      )}

      {verdict.kind === 'mismatch' && (
        <>
          <p>
            <strong>서명 당시 문서와 다릅니다.</strong> 서명 뒤에 계약 내용이 바뀌었을 수
            있습니다. 이 계약을 근거로 무엇을 청구하기 전에 원인을 먼저 확인하세요.
          </p>
          <dl className="mt-3 space-y-1 font-mono text-xs break-all">
            <div>
              <dt className="inline font-sans font-semibold">서명 시점 </dt>
              <dd className="inline">{verdict.stored}</dd>
            </div>
            <div>
              <dt className="inline font-sans font-semibold">현재 </dt>
              <dd className="inline">{verdict.actual}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
};

const AuditTrail = ({ trail }: { trail: SerializedAuditTrail }) => (
  <div className="p-6 md:p-8 border-b border-gray-200">
    <h2 className="text-lg font-bold text-gray-900 mb-1">감사추적</h2>
    <p className="text-sm text-gray-500 mb-5">
      서명을 부인당했을 때 내놓을 기록입니다. 계약서와 별개 문서이며 PDF에는 실리지 않습니다.
    </p>

    <ol className="space-y-0 mb-6">
      {trail.events.map((event, index) => (
        <li
          key={`${event.label}-${index}`}
          className="flex gap-3 py-2.5 border-b border-gray-100 last:border-b-0 text-sm"
        >
          <span
            aria-hidden="true"
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              event.chain ? 'bg-gray-900' : 'bg-gray-300'
            }`}
          />
          <span className="flex-1 min-w-0">
            <span className={event.chain ? 'font-semibold text-gray-900' : 'text-gray-700'}>
              {event.label}
            </span>
            {event.detail && (
              <span className="block text-xs text-gray-500 mt-0.5 break-all">{event.detail}</span>
            )}
          </span>
          <time className="shrink-0 text-xs text-gray-500 tabular-nums">{event.time}</time>
        </li>
      ))}
    </ol>

    {trail.chainGaps.length > 0 && (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-4">
        <p className="font-semibold mb-1">기록에 빈 곳이 있습니다</p>
        <ul className="list-disc pl-5 space-y-0.5">
          {trail.chainGaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </div>
    )}

    <Fingerprint verdict={trail.fingerprint} />
  </div>
);

export default AuditTrail;
