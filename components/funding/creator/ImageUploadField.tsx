import { useId, useState } from 'react';

interface Props {
  projectId: string;
  kind: 'cover' | 'body';
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}

/**
 * 개설자 이미지 업로드 — `pages/api/funding/creator/upload.ts`(원문 바이트를 그대로 받는
 * 라우트, `?projectId=&kind=`)에 파일 선택 즉시 올린다. 성공하면 받은 주소를 폼 값에
 * 그대로 넣는다(부모가 상태로 들고 있다가 구획 저장 시 함께 보낸다) — 업로드 자체는
 * 저장이 아니다. 실패 메시지는 서버가 준 한국어를 그대로 보여 준다.
 */
export function ImageUploadField({ projectId, kind, value, onChange, disabled, label, hint }: Props) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/funding/creator/upload?projectId=${encodeURIComponent(projectId)}&kind=${kind}`,
        { method: 'POST', body: file },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '이미지를 올리지 못했습니다.');
        return;
      }
      onChange(data.url);
    } catch {
      setError('연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="typo-card-meta font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {value && (
        // 업로드 직후 받은 주소를 그 자리에서 미리보기하는 자리라 next/image의 정적
        // 최적화 파이프라인을 탈 이유가 없다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-32 w-full max-w-xs rounded-lg border border-gray-200 object-cover dark:border-gray-700"
        />
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // 같은 파일을 다시 골라도 onChange가 다시 뜨도록 즉시 비운다.
          e.target.value = '';
          if (file) void upload(file);
        }}
        className="typo-body text-gray-700 disabled:opacity-50 dark:text-gray-300"
      />
      {busy && <p className="typo-caption text-gray-500 dark:text-gray-400">업로드 중…</p>}
      {error && (
        <p role="alert" className="typo-caption text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {hint && !error && <p className="typo-caption text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}
