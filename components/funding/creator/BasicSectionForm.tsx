import { useState, type FormEvent } from 'react';

import { Button } from '../../ui/Button';
import { Field, TextInput } from '../../ui/Field';
import { CREATOR_LIMITS } from '../../../lib/funding/creatorValidation';
import { saveBasicSection } from './api';
import { ImageUploadField } from './ImageUploadField';
import { IDLE_SAVE_STATE, type SaveState } from './types';

export interface BasicSectionValue {
  title: string;
  summary: string;
  slug: string;
  coverUrl: string;
  goalAmount: number;
  startAt: string;
  endAt: string;
}

interface Props {
  projectId: string;
  initial: BasicSectionValue;
  readOnly: boolean;
  onSaved: (value: BasicSectionValue) => void;
}

/** ISO 문자열 → `<input type="date">`가 받는 `YYYY-MM-DD`. */
const toDateInputValue = (iso: string): string => (iso ? iso.slice(0, 10) : '');

export function BasicSectionForm({ projectId, initial, readOnly, onSaved }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [slug, setSlug] = useState(initial.slug);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [goalAmount, setGoalAmount] = useState(String(initial.goalAmount));
  const [startAt, setStartAt] = useState(toDateInputValue(initial.startAt));
  const [endAt, setEndAt] = useState(toDateInputValue(initial.endAt));
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSave({ status: 'saving' });
    const value: BasicSectionValue = {
      title,
      summary,
      slug,
      coverUrl,
      goalAmount: Number(goalAmount),
      // 자정 기준으로 보낸다 — 서버는 Date로 다시 파싱해 리드타임(오늘+leadDays일)만 본다.
      startAt: startAt ? new Date(`${startAt}T00:00:00`).toISOString() : '',
      endAt: endAt ? new Date(`${endAt}T00:00:00`).toISOString() : '',
    };
    const result = await saveBasicSection(projectId, value);
    if (result.ok) {
      setSave({ status: 'success' });
      onSaved(value);
    } else {
      setSave({ status: 'error', message: result.message });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field id="basic-title" label="제목" required>
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={CREATOR_LIMITS.titleMax}
          disabled={readOnly}
          required
        />
      </Field>
      <Field id="basic-summary" label="한 줄 요약" required hint={`${CREATOR_LIMITS.summaryMax}자 이내`}>
        <TextInput
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={CREATOR_LIMITS.summaryMax}
          disabled={readOnly}
          required
        />
      </Field>
      <Field id="basic-slug" label="주소(slug)" required hint="studionol.co.kr/ko/funding/<주소> — 영문 소문자·숫자·하이픈만">
        <TextInput
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={readOnly}
          required
        />
      </Field>
      <ImageUploadField
        projectId={projectId}
        kind="cover"
        value={coverUrl}
        onChange={setCoverUrl}
        disabled={readOnly}
        label="대표 이미지"
      />
      <Field
        id="basic-goal"
        label="목표 금액"
        required
        hint={`만원 단위, ${CREATOR_LIMITS.goalMin.toLocaleString()}원~${CREATOR_LIMITS.goalMax.toLocaleString()}원`}
      >
        <TextInput
          type="number"
          value={goalAmount}
          onChange={(e) => setGoalAmount(e.target.value)}
          min={CREATOR_LIMITS.goalMin}
          max={CREATOR_LIMITS.goalMax}
          step={10_000}
          disabled={readOnly}
          required
        />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="basic-start"
          label="시작일"
          required
          hint={`심사에 시간이 걸립니다 — 오늘부터 ${CREATOR_LIMITS.leadDays}일 뒤부터 고를 수 있습니다.`}
        >
          <TextInput type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} disabled={readOnly} required />
        </Field>
        <Field id="basic-end" label="종료일" required hint={`모금 기간은 최대 ${CREATOR_LIMITS.maxDurationDays}일입니다.`}>
          <TextInput type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} disabled={readOnly} required />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={readOnly || save.status === 'saving'}>
          {save.status === 'saving' ? '저장 중…' : '기본정보 저장'}
        </Button>
        {save.status === 'success' && <span className="typo-caption text-green-600 dark:text-green-400">저장했습니다.</span>}
        {save.status === 'error' && (
          <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{save.message}</span>
        )}
      </div>
    </form>
  );
}
