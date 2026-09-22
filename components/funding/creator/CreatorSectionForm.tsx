import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '../../ui/Button';
import { Field, TextArea, TextInput } from '../../ui/Field';
import { CREATOR_LIMITS } from '../../../lib/funding/creatorValidation';
import { saveCreatorSection } from './api';
import type { EditorCreatorProfile } from './types';
import { IDLE_SAVE_STATE, type SaveState } from './types';

interface Props {
  projectId: string;
  initial: EditorCreatorProfile;
  readOnly: boolean;
  /**
   * 지금 이름이 잠겨 있는지 — `lib/funding/creatorProjectWrite.ts`의 `isCreatorNameLocked`가
   * 편집 화면 로드 시점에 판정해 내려준 값이다. 저장을 눌러야 비로소 `locked` 오류로
   * 아는 대신, 칸 자체를 비활성화하고 이유를 미리 보여준다. 서버(`saveCreatorSection`)가
   * 여전히 유일한 집행자다 — 이 값은 안내일 뿐이다.
   */
  nameLocked: boolean;
  onSaved: (value: EditorCreatorProfile) => void;
  /** BasicSectionForm과 같은 계약 — 저장 안 한 입력이 있으면 부모에 알린다. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * 개설자 정보 구획.
 *
 * `saveCreatorSection`은 URL의 프로젝트 id를 쓰지 않는다 — 개설자 프로필은 계정 소속이라
 * 이 프로젝트가 승인·반려된 뒤에도(계정의 다른 초안에서) 고칠 수 있다. 그래도 이 화면
 * 자체는 지금 열고 있는 프로젝트가 편집 가능한 동안에만 폼을 노출한다(readOnly는 부모가
 * 프로젝트 상태로 판단해 내려준다) — 심사 중인 프로젝트를 보면서 계정 프로필을 태연히
 * 바꾸는 것은 "무엇을 고치는 화면인지" 헷갈리게 만든다.
 */
export function CreatorSectionForm({ projectId: _projectId, initial, readOnly, nameLocked, onSaved, onDirtyChange }: Props) {
  const [name, setName] = useState(initial.name);
  const [contactName, setContactName] = useState(initial.contactName ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [linksText, setLinksText] = useState((initial.links ?? []).join('\n'));
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);

  // BasicSectionForm과 같은 이유·같은 방식(파생값, 별도 state 없음).
  const dirty = name !== initial.name
    || contactName !== (initial.contactName ?? '')
    || phone !== (initial.phone ?? '')
    || bio !== (initial.bio ?? '')
    || linksText !== (initial.links ?? []).join('\n');
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  // 저장 성공/실패 표시는 그 저장 결과에 대한 것이다 — 그 뒤 입력이 바뀌면 낡은
  // 안내로 남는다(2026-09-17 리뷰 지적).
  const clearSaveStatus = () => setSave((s) => (s.status === 'idle' ? s : IDLE_SAVE_STATE));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSave({ status: 'saving' });
    const links = linksText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const value: EditorCreatorProfile = {
      name,
      contactName: contactName.trim() || null,
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      links: links.length > 0 ? links : null,
    };
    // saveCreatorSection이 URL id를 쓰지 않으므로 어떤 프로젝트 id를 붙여도 무관하지만,
    // 라우트 스키마는 여전히 :id 세그먼트를 요구한다(프로젝트별 저장 라우트를 공유하기
    // 때문) — 지금 열려 있는 프로젝트의 id를 그대로 쓴다.
    const result = await saveCreatorSection(_projectId, value);
    if (result.ok) {
      // BasicSectionForm의 setSlug(normalizedSlug)와 같은 이유·같은 처방(2026-09-22
      // 리뷰 지적). submit이 trim·빈 값→null·줄 필터링으로 정규화한 값을 서버로
      // 보내는데, 로컬 입력(contactName·phone·bio·linksText)은 원문 그대로 남아 있으면
      // dirty 판정이 "원문 vs 정규화된 initial"을 비교하게 되어 저장에 성공해도 영영
      // dirty가 안 풀린다 — 이탈 경고가 매번 뜨면 사용자가 그 경고를 무시하게 되어
      // 가드 자체가 무력해진다. 저장한 값 그대로 로컬 상태를 되돌린다.
      setContactName(value.contactName ?? '');
      setPhone(value.phone ?? '');
      setBio(value.bio ?? '');
      setLinksText((value.links ?? []).join('\n'));
      setSave({ status: 'success' });
      onSaved(value);
    } else {
      setSave({ status: 'error', message: result.message });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field id="creator-name" label="공개 이름" required>
        <TextInput
          value={name}
          onChange={(e) => { setName(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.nameMax}
          disabled={readOnly || nameLocked}
          required
        />
      </Field>
      {nameLocked && (
        <p className="-mt-3 text-xs text-gray-600">
          승인된 프로젝트가 있어 이름은 바꿀 수 없습니다. 프로젝트 상세 화면에 판매자 표시로
          그대로 노출되는 값이기 때문입니다. 소개·연락처·링크는 계속 고칠 수 있습니다.
        </p>
      )}
      <Field id="creator-contact-name" label="담당자 이름" hint="운영자만 볼 수 있습니다.">
        <TextInput
          value={contactName}
          onChange={(e) => { setContactName(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.contactNameMax}
          disabled={readOnly}
        />
      </Field>
      <Field id="creator-phone" label="연락처" hint="운영자만 볼 수 있습니다.">
        <TextInput
          value={phone}
          onChange={(e) => { setPhone(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.phoneMax}
          disabled={readOnly}
        />
      </Field>
      <Field id="creator-bio" label="소개" hint={`${CREATOR_LIMITS.bioMax}자 이내`}>
        <TextArea
          value={bio}
          onChange={(e) => { setBio(e.target.value); clearSaveStatus(); }}
          maxLength={CREATOR_LIMITS.bioMax}
          disabled={readOnly}
        />
      </Field>
      <Field id="creator-links" label="링크" hint={`한 줄에 하나씩, http(s)로 시작하는 주소만. 최대 ${CREATOR_LIMITS.linksMax}개`}>
        <TextArea
          value={linksText}
          onChange={(e) => { setLinksText(e.target.value); clearSaveStatus(); }}
          disabled={readOnly}
          placeholder="https://..."
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={readOnly || save.status === 'saving'}>
          {save.status === 'saving' ? '저장 중…' : '개설자 정보 저장'}
        </Button>
        {save.status === 'success' && <span className="typo-caption text-green-600 dark:text-green-400">저장했습니다.</span>}
        {save.status === 'error' && (
          <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{save.message}</span>
        )}
      </div>
    </form>
  );
}
