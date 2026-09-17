import { useState, type FormEvent } from 'react';

import { Button } from '../../ui/Button';
import { Field, TextInput } from '../../ui/Field';
import { kstEndOfDayIso, kstStartOfDayIso } from '../../../lib/funding/creatorDateInput';
import { CREATOR_LIMITS } from '../../../lib/funding/creatorValidation';
import { saveBasicSection } from './api';
import { ImageUploadField } from './ImageUploadField';
import { IDLE_SAVE_STATE, type SaveState } from './types';

export interface BasicSectionValue {
  title: string;
  summary: string;
  /** 정규화된(trim + 소문자) 주소. 서버가 저장하는 값과 항상 같다. */
  slug: string;
  coverUrl: string;
  goalAmount: number;
  /** KST 달력 날짜 `YYYY-MM-DD`. `EditorProject.startAt`과 같은 형식(types.ts 참조). */
  startAt: string;
  endAt: string;
}

interface Props {
  projectId: string;
  initial: BasicSectionValue;
  /** GSSP가 요청 시각 기준으로 미리 계산해 내려준 값 — 브라우저 시계로 다시 계산하지 않는다. */
  earliestStartDate: string;
  readOnly: boolean;
  onSaved: (value: BasicSectionValue) => void;
}

/** 초안 생성 직후의 임시 주소(`createDraftProject`가 붙인 `draft-<uuid>`)는 실제 주소가 아니다. */
const isDraftPlaceholderSlug = (slug: string): boolean => slug.startsWith('draft-');

export function BasicSectionForm({ projectId, initial, earliestStartDate, readOnly, onSaved }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  // 임시 주소를 폼에 그대로 채우지 않는다 — 개설자가 손대지 않으면 그 임시값이 영구
  // 주소로 저장된다(2026-09-17 리뷰 지적).
  const [slug, setSlug] = useState(isDraftPlaceholderSlug(initial.slug) ? '' : initial.slug);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [goalAmount, setGoalAmount] = useState(String(initial.goalAmount));
  const [startAt, setStartAt] = useState(initial.startAt);
  const [endAt, setEndAt] = useState(initial.endAt);
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);

  // 저장 성공/실패 표시는 그 저장 결과에 대한 것이다 — 그 뒤 아무 입력이나 바뀌면
  // "저장했습니다"가 낡은 안내로 남는다(2026-09-17 리뷰 지적). 필드마다 onChange에서
  // 이 한 줄을 부른다.
  const clearSaveStatus = () => setSave((s) => (s.status === 'idle' ? s : IDLE_SAVE_STATE));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSave({ status: 'saving' });
    // trim + 소문자는 서버(validateBasicSection)가 항상 하는 정규화다. 여기서도 미리
    // 맞춰 두지 않으면, 대문자를 섞어 저장한 뒤 이 값을 그대로 부모 상태로 올릴 때
    // 실제 DB에 저장된 주소(소문자)와 화면이 들고 있는 주소(원문)가 갈린다 — 스토리
    // 탭의 미리보기 링크가 그 갈라진 값을 쓰면 404가 난다(2026-09-17 리뷰 지적).
    const normalizedSlug = slug.trim().toLowerCase();
    const value: BasicSectionValue = {
      title,
      summary,
      slug: normalizedSlug,
      coverUrl,
      goalAmount: Number(goalAmount),
      startAt,
      endAt,
    };
    const result = await saveBasicSection(projectId, {
      ...value,
      startAt: startAt ? kstStartOfDayIso(startAt) : '',
      endAt: endAt ? kstEndOfDayIso(endAt) : '',
    });
    if (result.ok) {
      setSlug(normalizedSlug);
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
          onChange={(e) => { setTitle(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.titleMax}
          disabled={readOnly}
          required
        />
      </Field>
      <Field id="basic-summary" label="한 줄 요약" required hint={`${CREATOR_LIMITS.summaryMax}자 이내`}>
        <TextInput
          value={summary}
          onChange={(e) => { setSummary(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.summaryMax}
          disabled={readOnly}
          required
        />
      </Field>
      <Field id="basic-slug" label="주소(slug)" required hint="studionol.co.kr/ko/funding/<주소> — 영문 소문자·숫자·하이픈만">
        <TextInput
          value={slug}
          onChange={(e) => { setSlug(e.target.value); clearSaveStatus(); }}
          disabled={readOnly}
          required
        />
      </Field>
      <ImageUploadField
        projectId={projectId}
        kind="cover"
        value={coverUrl}
        onChange={(url) => { setCoverUrl(url); clearSaveStatus(); }}
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
          onChange={(e) => { setGoalAmount(e.target.value); clearSaveStatus(); }}
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
          hint={`심사에 시간이 걸립니다 — ${earliestStartDate}부터 고를 수 있습니다.`}
        >
          <TextInput
            type="date"
            value={startAt}
            min={earliestStartDate}
            onChange={(e) => { setStartAt(e.target.value); clearSaveStatus(); }}
            disabled={readOnly}
            required
          />
        </Field>
        <Field id="basic-end" label="종료일" required hint={`모금 기간은 최대 ${CREATOR_LIMITS.maxDurationDays}일입니다.`}>
          <TextInput
            type="date"
            value={endAt}
            min={startAt || earliestStartDate}
            onChange={(e) => { setEndAt(e.target.value); clearSaveStatus(); }}
            disabled={readOnly}
            required
          />
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
