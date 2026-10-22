/**
 * 관리자 입력창 겸 확인창(components/admin/useAdminDialog.tsx) 테스트 도우미 — 예전 `window.prompt` 목 자리.
 */
import { fireEvent, screen } from '@testing-library/react';

export const findAdminDialog = () => screen.findByRole('dialog');

/** 첫 칸에 값을 넣고(주면) 확인 버튼을 누른다. */
export const submitAdminDialog = async (value?: string) => {
  const dialog = await findAdminDialog();
  if (value !== undefined) {
    const field = dialog.querySelector('textarea, input, select');
    if (!field) throw new Error('입력 칸이 없는 확인창입니다.');
    fireEvent.change(field, { target: { value } });
  }
  const submit = dialog.querySelector('button[type="submit"]');
  if (!submit) throw new Error('확인 버튼이 없습니다.');
  fireEvent.click(submit);
  return dialog;
};

export const cancelAdminDialog = async () => {
  const dialog = await findAdminDialog();
  const cancel = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.trim() === '취소');
  if (!cancel) throw new Error('취소 버튼이 없습니다.');
  fireEvent.click(cancel);
};
