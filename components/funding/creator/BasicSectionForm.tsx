import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '../../ui/Button';
import { Field, TextInput } from '../../ui/Field';
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
  /** 승인 뒤에는 구획은 열려 있지만 주소·목표 금액·모금 기간은 잠긴다(서버의 basicLockedViolation과 같은 규칙). */
  lockedFields?: boolean;
  onSaved: (value: BasicSectionValue) => void;
  /**
   * 이 구획의 입력이 마지막으로 저장된 값과 달라졌는지를 부모(편집 화면)에 알린다.
   * 부모는 네 구획 중 하나라도 dirty면 이탈 전 확인을 건다(2026-09-22, "저장 안 한
   * 입력이 경고 없이 사라진다" 대응). 저장이 아니라 저장 "안 한" 상태를 보고하는
   * 것이므로 자동 저장으로 이어지지 않는다.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

/** 초안 생성 직후의 임시 주소(`createDraftProject`가 붙인 `draft-<uuid>`)는 실제 주소가 아니다. */
const isDraftPlaceholderSlug = (slug: string): boolean => slug.startsWith('draft-');

export function BasicSectionForm({ projectId, initial, earliestStartDate, readOnly, lockedFields, onSaved, onDirtyChange }: Props) {
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

  // 저장된 값(initial)과 지금 입력을 비교한다 — 별도 dirty state를 두지 않고 매 렌더
  // 파생시킨다. 저장에 성공하면 onSaved가 부모의 project.title 등을 갱신하고, 그 값이
  // 다음 렌더의 initial로 그대로 내려오므로(같은 구획을 이 폼 말고는 아무도 안 건드린다)
  // 저장 직후 자연히 dirty=false가 된다 — 따로 리셋 로직이 필요 없다.
  const initialSlugValue = isDraftPlaceholderSlug(initial.slug) ? '' : initial.slug;
  const dirty = title !== initial.title
    || summary !== initial.summary
    || slug !== initialSlugValue
    || coverUrl !== initial.coverUrl
    || Number(goalAmount) !== initial.goalAmount
    || startAt !== initial.startAt
    || endAt !== initial.endAt;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

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
    // KST 자정·23:59:59 변환은 **서버가 한다**(validateBasicSection). 여기서 한 번 더 하면
    // 두 곳에 같은 규칙이 생기고, 서버는 그 변환을 신뢰만 하게 된다 — bare 날짜가 오는
    // 다른 경로가 생기면 조용히 하루 앞당겨 마감됐다. 화면은 고른 날짜를 그대로 보낸다.
    const result = await saveBasicSection(projectId, value);
    if (result.ok) {
      // 저장 요청이 도는 동안(왕복 100~500ms) 슬러그 칸은 계속 활성이라, 응답이 오기
      // 전에 이어서 고친 값이 있을 수 있다. 무조건 덮어쓰면 그 값이 조용히 사라진다 —
      // `slug`는 이 submit 클로저가 잡고 있는 제출 시점 값이라, 지금(cur) 값이 그때와
      // 같을 때만(그 사이 아무도 안 고쳤을 때만) 정규화된 값으로 되돌린다
      // (2026-09-22 2차 리뷰 지적 — CreatorSectionForm.tsx와 같은 처방).
      setSlug((cur) => (cur === slug ? normalizedSlug : cur));
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
          disabled={readOnly || lockedFields}
          required
        />
      </Field>
      {lockedFields && (
        <p className="-mt-3 text-xs text-gray-600">
          공개된 뒤에는 바꿀 수 없습니다 — 후원자가 이 주소로 프로젝트를 찾고, 모금 기간과 목표
          금액은 후원자와의 약속입니다.
        </p>
      )}
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
          disabled={readOnly || lockedFields}
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
            disabled={readOnly || lockedFields}
            required
          />
        </Field>
        <Field id="basic-end" label="종료일" required hint={`모금 기간은 최대 ${CREATOR_LIMITS.maxDurationDays}일입니다.`}>
          <TextInput
            type="date"
            value={endAt}
            min={startAt || earliestStartDate}
            onChange={(e) => { setEndAt(e.target.value); clearSaveStatus(); }}
            disabled={readOnly || lockedFields}
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
