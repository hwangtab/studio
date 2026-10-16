import React, { useState } from 'react';

import { Button } from '../ui/Button';

/**
 * 운영자 화면의 개설자 계정(이름·로그인 이메일) 인라인 수정 — 상점 아티스트·공연 등록 상세가 같은 폼을 쓴다.
 * 펀딩 프로젝트 없이 들어온 개설자가 메일함을 잃거나 이름을 잘못 적었을 때 고칠 유일한 길이다.
 * `/api/admin/creators/<id>/account`가 판정한다 — 이메일을 바꾸면 그 개설자의 로그인 링크·열린 세션이 모두 끊기고
 * 옛·새 주소로 알림 메일이 간다. 사유는 필수이며 메일과 서버 로그에만 남는다.
 */

type Field = 'set_creator_name' | 'set_creator_email';

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70';

export function CreatorAccountEditor({
  creatorId,
  name,
  email,
}: {
  creatorId: string;
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<Field>('set_creator_email');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pick = (next: Field) => {
    setAction(next);
    setValue(next === 'set_creator_name' ? name : email);
    setMessage(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(`/api/admin/creators/${encodeURIComponent(creatorId)}/account`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value, reason }),
      });
      const body = (await r.json()) as { ok: boolean; message?: string; warnings?: string[] };
      if (!r.ok || !body.ok) {
        setMessage(body.message ?? '변경하지 못했어요.');
      } else if (body.warnings?.length) {
        // 메일 실패 같은 경고는 새로고침으로 지워지지 않게 먼저 알린다.
        window.alert(`변경은 반영됐지만 확인할 것이 있어요.\n${body.warnings.join('\n')}`);
        window.location.reload();
      } else {
        window.location.reload();
      }
    } catch {
      setMessage('네트워크 오류');
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); pick('set_creator_email'); }}
        className="text-xs font-semibold text-primary-dark underline underline-offset-2"
      >
        수정
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
      <div className="flex gap-3" role="radiogroup" aria-label="바꿀 항목">
        <label className="flex items-center gap-1">
          <input type="radio" className="accent-primary" checked={action === 'set_creator_email'} onChange={() => pick('set_creator_email')} />
          로그인 이메일
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" className="accent-primary" checked={action === 'set_creator_name'} onChange={() => pick('set_creator_name')} />
          이름
        </label>
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={action === 'set_creator_name' ? '새 이름' : '새 이메일'}
        className={inputClass}
        required
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="변경 사유 (필수 — 개설자에게 가는 메일에 실려요)"
        aria-label="변경 사유"
        className={inputClass}
        required
      />
      {action === 'set_creator_email' && (
        <p className="text-xs text-gray-600">이메일을 바꾸면 이 개설자의 로그인 링크와 열린 세션이 모두 끊겨요.</p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" light variant="weak" size="sm" disabled={busy}>{busy ? '저장 중…' : '변경'}</Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-600 underline">닫기</button>
        {message && <span role="alert" className="text-xs text-red-700">{message}</span>}
      </div>
    </form>
  );
}
