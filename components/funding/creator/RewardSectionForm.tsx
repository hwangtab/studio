import { useState, type FormEvent } from 'react';

import { Button } from '../../ui/Button';
import { Field, TextArea, TextInput } from '../../ui/Field';
import { CREATOR_LIMITS, type RewardInput } from '../../../lib/funding/creatorValidation';
import { createReward, deleteReward as deleteRewardApi, updateReward } from './api';
import { ImageUploadField } from './ImageUploadField';
import { IDLE_SAVE_STATE, type EditorReward, type SaveState } from './types';

interface Props {
  projectId: string;
  initial: EditorReward[];
  readOnly: boolean;
  onSaved: (rewards: EditorReward[]) => void;
}

interface FormValues {
  rewardId: string;
  title: string;
  description: string;
  amount: string;
  limited: boolean;
  totalQuantity: string;
  requiresShipping: boolean;
  estimatedDelivery: string;
  imageUrl: string | null;
}

const BLANK_FORM: FormValues = {
  rewardId: '', title: '', description: '', amount: '', limited: false, totalQuantity: '',
  requiresShipping: false, estimatedDelivery: '', imageUrl: null,
};

const toFormValues = (r: EditorReward): FormValues => ({
  rewardId: r.rewardId,
  title: r.title,
  description: r.description,
  amount: String(r.amount),
  limited: r.totalQuantity !== null,
  totalQuantity: r.totalQuantity !== null ? String(r.totalQuantity) : '',
  requiresShipping: r.requiresShipping,
  estimatedDelivery: r.estimatedDelivery,
  imageUrl: r.imageUrl,
});

/**
 * 리워드 구획 — 카드 목록 + 추가·수정·삭제 폼 하나(같은 폼을 생성·수정 겸용으로 쓴다).
 *
 * 수정 진입 시 원래 rewardId를 `editingRewardId`에 잡아 두고, 저장할 때
 * `previousRewardId`로 그대로 보낸다 — 개설자가 폼 안에서 주소(rewardId)를 고쳐도
 * "무엇을 고치는 요청인지"를 라우트가 잃지 않는다(빠뜨리면 리워드가 하나씩 늘어나는
 * 사고, task-7-report.md 참조). 새 리워드 추가는 `mode: 'create'`로 별도 API를 부른다 —
 * 이미 쓰는 주소를 적으면 서버가 400과 함께 그 사실을 그대로 알려 준다.
 *
 * 잠긴(승인된) 리워드는 주소·금액·수량 제한 여부·배송 여부 입력을 비활성으로 두고
 * 이유를 한 줄 적는다. 제목·설명·예상 전달 시기·이미지는 그대로 고칠 수 있다.
 */
export function RewardSectionForm({ projectId, initial, readOnly, onSaved }: Props) {
  const [rewards, setRewards] = useState<EditorReward[]>(initial);
  const [creating, setCreating] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(BLANK_FORM);
  const [save, setSave] = useState<SaveState>(IDLE_SAVE_STATE);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const editingReward = editingRewardId ? rewards.find((r) => r.rewardId === editingRewardId) ?? null : null;
  const locked = editingReward?.locked ?? false;
  const showForm = creating || editingReward !== null;

  const startCreate = () => {
    setCreating(true);
    setEditingRewardId(null);
    setForm(BLANK_FORM);
    setSave(IDLE_SAVE_STATE);
  };

  const startEdit = (r: EditorReward) => {
    setCreating(false);
    setEditingRewardId(r.rewardId);
    setForm(toFormValues(r));
    setSave(IDLE_SAVE_STATE);
  };

  const cancel = () => {
    setCreating(false);
    setEditingRewardId(null);
    setForm(BLANK_FORM);
    setSave(IDLE_SAVE_STATE);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setSave({ status: 'saving' });
    const value: RewardInput = {
      rewardId: form.rewardId.trim(),
      title: form.title,
      description: form.description,
      amount: Number(form.amount),
      totalQuantity: form.limited ? Number(form.totalQuantity) : null,
      requiresShipping: form.requiresShipping,
      estimatedDelivery: form.estimatedDelivery,
      imageUrl: form.imageUrl,
    };
    const result = creating
      ? await createReward(projectId, value)
      : await updateReward(projectId, value, editingReward!.rewardId);
    if (!result.ok) {
      setSave({ status: 'error', message: result.message });
      return;
    }
    const nextReward: EditorReward = { ...value, locked };
    const nextRewards = creating
      ? [...rewards, nextReward]
      : rewards.map((r) => (r.rewardId === editingReward!.rewardId ? nextReward : r));
    setRewards(nextRewards);
    onSaved(nextRewards);
    cancel();
  };

  const remove = async (rewardId: string) => {
    setDeletingId(rewardId);
    setDeleteError(null);
    const result = await deleteRewardApi(projectId, rewardId);
    setDeletingId(null);
    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }
    const nextRewards = rewards.filter((r) => r.rewardId !== rewardId);
    setRewards(nextRewards);
    onSaved(nextRewards);
  };

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {rewards.length === 0 && (
          <p className="typo-body text-gray-500 dark:text-gray-400">아직 등록한 리워드가 없습니다.</p>
        )}
        {rewards.map((r) => (
          <li key={r.rewardId} className="glass-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.title}</p>
                <p className="typo-card-meta text-gray-500 dark:text-gray-400">
                  {r.amount.toLocaleString()}원 · {r.totalQuantity !== null ? `한정 ${r.totalQuantity}개` : '무제한'}
                  {r.locked && ' · 공개됨(잠김)'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => startEdit(r)} disabled={readOnly}>
                  수정
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600 dark:text-red-400"
                  onClick={() => remove(r.rewardId)}
                  disabled={readOnly || r.locked || deletingId === r.rewardId}
                >
                  {deletingId === r.rewardId ? '삭제 중…' : '삭제'}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {deleteError && <p role="alert" className="typo-caption text-red-600 dark:text-red-400">{deleteError}</p>}

      {!showForm && (
        <Button type="button" onClick={startCreate} disabled={readOnly || rewards.length >= CREATOR_LIMITS.rewardsMax}>
          리워드 추가
        </Button>
      )}

      {showForm && (
        <form onSubmit={submitForm} className="glass-card flex flex-col gap-5 rounded-2xl p-5">
          <h3 className="font-semibold">{creating ? '리워드 추가' : '리워드 수정'}</h3>
          <Field
            id="reward-id"
            label="리워드 주소(id)"
            required
            hint={locked ? '공개된 리워드는 주소를 바꿀 수 없습니다.' : '영문 소문자·숫자·하이픈만'}
          >
            <TextInput
              value={form.rewardId}
              onChange={(e) => setForm((f) => ({ ...f, rewardId: e.target.value }))}
              maxLength={CREATOR_LIMITS.rewardIdMax}
              disabled={readOnly || locked}
              required
            />
          </Field>
          <Field id="reward-title" label="이름" required>
            <TextInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={CREATOR_LIMITS.rewardTitleMax}
              disabled={readOnly}
              required
            />
          </Field>
          <Field id="reward-description" label="설명" required hint={`${CREATOR_LIMITS.rewardDescriptionMax}자 이내`}>
            <TextArea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={CREATOR_LIMITS.rewardDescriptionMax}
              disabled={readOnly}
              required
            />
          </Field>
          <Field
            id="reward-amount"
            label="금액"
            required
            hint={locked ? '공개된 리워드는 금액을 바꿀 수 없습니다.' : `${CREATOR_LIMITS.amountStep.toLocaleString()}원 단위`}
          >
            <TextInput
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              min={CREATOR_LIMITS.amountMin}
              max={CREATOR_LIMITS.amountMax}
              step={CREATOR_LIMITS.amountStep}
              disabled={readOnly || locked}
              required
            />
          </Field>
          <div className="flex items-center gap-2">
            <input
              id="reward-limited"
              type="checkbox"
              checked={form.limited}
              onChange={(e) => setForm((f) => ({ ...f, limited: e.target.checked }))}
              disabled={readOnly || locked}
              className="h-4 w-4 accent-primary"
            />
            <label htmlFor="reward-limited" className="typo-body">수량 한정</label>
          </div>
          {form.limited && (
            <Field id="reward-quantity" label="수량" required>
              <TextInput
                type="number"
                value={form.totalQuantity}
                onChange={(e) => setForm((f) => ({ ...f, totalQuantity: e.target.value }))}
                min={1}
                disabled={readOnly || locked}
                required
              />
            </Field>
          )}
          <div className="flex items-center gap-2">
            <input
              id="reward-shipping"
              type="checkbox"
              checked={form.requiresShipping}
              onChange={(e) => setForm((f) => ({ ...f, requiresShipping: e.target.checked }))}
              disabled={readOnly || locked}
              className="h-4 w-4 accent-primary"
            />
            <label htmlFor="reward-shipping" className="typo-body">배송이 필요합니다</label>
          </div>
          {locked && (
            <p className="typo-caption text-amber-700 dark:text-amber-400">
              공개된 리워드는 주소·금액·수량 제한 여부·배송 여부를 바꿀 수 없습니다. 새 리워드를 추가해 주세요.
            </p>
          )}
          <Field id="reward-delivery" label="예상 전달 시기" required hint="예: 2026년 12월">
            <TextInput
              value={form.estimatedDelivery}
              onChange={(e) => setForm((f) => ({ ...f, estimatedDelivery: e.target.value }))}
              maxLength={CREATOR_LIMITS.estimatedDeliveryMax}
              disabled={readOnly}
              required
            />
          </Field>
          <ImageUploadField
            projectId={projectId}
            kind="body"
            value={form.imageUrl ?? ''}
            onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            disabled={readOnly}
            label="리워드 이미지(선택)"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={readOnly || save.status === 'saving'}>
              {save.status === 'saving' ? '저장 중…' : '리워드 저장'}
            </Button>
            <Button type="button" variant="outline" onClick={cancel} disabled={save.status === 'saving'}>
              취소
            </Button>
            {save.status === 'error' && (
              <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{save.message}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
