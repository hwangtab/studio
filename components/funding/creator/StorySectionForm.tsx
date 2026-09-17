import { useId, useRef, useState, type FormEvent } from 'react';

import { Button } from '../../ui/Button';
import { CREATOR_LIMITS } from '../../../lib/funding/creatorValidation';
import { saveStorySection } from './api';
import { IDLE_SAVE_STATE, type SaveState } from './types';

interface Props {
  projectId: string;
  slug: string;
  reviewStatus: string;
  initial: string;
  readOnly: boolean;
  onSaved: (content: string) => void;
}

/**
 * 스토리 구획 — 마크다운 textarea + 이미지 삽입 + 미리보기.
 *
 * 미리보기는 아직 개설자 전용 렌더가 없다(다음 태스크 범위) — 승인된 프로젝트만 실제
 * 공개 페이지로 열어 확인할 수 있고, 그 전에는 "승인 후 확인할 수 있다"는 안내만 둔다.
 * 없는 화면으로 링크를 걸어 두는 것보다 정직하다.
 */
export function StorySectionForm({ projectId, slug, reviewStatus, initial, readOnly, onSaved }: Props) {
  const textareaId = useId();
  const fileInputId = useId();
  const [content, setContent] = useState(initial);
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 저장 성공/실패 표시는 그 저장 결과에 대한 것이다 — 그 뒤 본문이 바뀌면 낡은
  // 안내로 남는다(2026-09-17 리뷰 지적).
  const clearSaveStatus = () => setSave((s) => (s.status === 'idle' ? s : IDLE_SAVE_STATE));

  const insertAtCursor = (text: string) => {
    clearSaveStatus();
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => `${c}\n${text}\n`);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${text}${content.slice(end)}`;
    setContent(next);
    // 커서를 삽입한 텍스트 뒤로 옮긴다. 다음 렌더 이후에 포커스를 되돌려야 위치가 반영된다.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleImagePick = async (file: File) => {
    setUploadBusy(true);
    setUploadError(null);
    try {
      const res = await fetch(
        `/api/funding/creator/upload?projectId=${encodeURIComponent(projectId)}&kind=body`,
        { method: 'POST', body: file },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setUploadError(data?.message ?? '이미지를 올리지 못했습니다.');
        return;
      }
      insertAtCursor(`![](${data.url})`);
    } catch {
      setUploadError('연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUploadBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSave({ status: 'saving' });
    const result = await saveStorySection(projectId, { content });
    if (result.ok) {
      setSave({ status: 'success' });
      onSaved(content);
    } else {
      setSave({ status: 'error', message: result.message });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={textareaId} className="typo-card-meta font-medium text-gray-700 dark:text-gray-300">
          본문(마크다운)
        </label>
        <div className="flex items-center gap-3">
          <label
            htmlFor={fileInputId}
            className={`typo-caption cursor-pointer underline underline-offset-2 ${readOnly || uploadBusy ? 'pointer-events-none opacity-50' : 'text-primary dark:text-primary-lighter'}`}
          >
            {uploadBusy ? '업로드 중…' : '이미지 삽입'}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={readOnly || uploadBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImagePick(file);
            }}
          />
          {reviewStatus === 'approved' ? (
            <a
              href={`/ko/funding/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="typo-caption text-primary underline underline-offset-2 dark:text-primary-lighter"
            >
              미리보기
            </a>
          ) : (
            <span className="typo-caption text-gray-400 dark:text-gray-500" title="승인된 뒤 공개 페이지에서 확인할 수 있습니다.">
              미리보기(승인 후)
            </span>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        id={textareaId}
        value={content}
        onChange={(e) => { setContent(e.target.value); clearSaveStatus(); }}
        disabled={readOnly}
        maxLength={CREATOR_LIMITS.contentMax}
        rows={20}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono typo-body text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />
      {uploadError && (
        <p role="alert" className="typo-caption text-red-600 dark:text-red-400">{uploadError}</p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={readOnly || save.status === 'saving'}>
          {save.status === 'saving' ? '저장 중…' : '스토리 저장'}
        </Button>
        {save.status === 'success' && <span className="typo-caption text-green-600 dark:text-green-400">저장했습니다.</span>}
        {save.status === 'error' && (
          <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{save.message}</span>
        )}
      </div>
    </form>
  );
}
