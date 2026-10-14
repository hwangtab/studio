import { useId, useState } from 'react';

import { Field, TextInput } from '../../ui/Field';

interface SharedProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}

/**
 * 업로드 대상은 셋 중 하나다 — 다른 라우트의 전체 주소(`uploadUrl`, 공연 포스터·출연진 사진 —
 * `components/shows/organizer/api.ts`의 showUploadUrl), 펀딩 업로드 라우트에 붙일 쿼리 문자열
 * (`uploadQuery`, 예: `target=shop-profile`·상점 상품 사진), 또는 펀딩 프로젝트 이미지(`projectId`+`kind`).
 */
type Props = SharedProps & (
  | { uploadUrl: string }
  | { uploadQuery: string }
  | { projectId: string; kind: 'cover' | 'body' }
);

const targetUrl = (p: Props): string => {
  if ('uploadUrl' in p) return p.uploadUrl;
  if ('uploadQuery' in p) return `/api/funding/creator/upload?${p.uploadQuery}`;
  return `/api/funding/creator/upload?projectId=${encodeURIComponent(p.projectId)}&kind=${p.kind}`;
};

/**
 * 개설자 이미지 업로드 — `pages/api/funding/creator/upload.ts`(원문 바이트를 그대로 받는
 * 라우트, `?projectId=&kind=`)에 파일 선택 즉시 올린다. 성공하면 받은 주소를 폼 값에
 * 그대로 넣는다(부모가 상태로 들고 있다가 구획 저장 시 함께 보낸다) — 업로드 자체는
 * 저장이 아니다. 실패 메시지는 서버가 준 한국어를 그대로 보여 준다.
 */
export function ImageUploadField(props: Props) {
  const { value, onChange, disabled, label, hint } = props;
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        targetUrl(props),
        { method: 'POST', body: file },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '이미지를 올리지 못했어요.');
        return;
      }
      onChange(data.url);
    } catch {
      setError('연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
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
      {/* 오류가 있으면 힌트 대신 오류만 보인다(Field가 둘을 함께 그리므로 여기서 가른다). */}
      <Field id={inputId} label={label} hint={error ? undefined : hint} error={error ?? undefined}>
        <TextInput
          type="file"
          accept="image/*"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 같은 파일을 다시 골라도 onChange가 다시 뜨도록 즉시 비운다.
            e.target.value = '';
            if (file) void upload(file);
          }}
          className="file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200"
        />
      </Field>
      {busy && <p className="typo-caption text-gray-500 dark:text-gray-400">업로드 중…</p>}
    </div>
  );
}
