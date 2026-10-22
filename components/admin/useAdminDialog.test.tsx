import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { useAdminDialog, type AdminDialogSpec } from './useAdminDialog';

const Harness = ({ spec }: { spec: AdminDialogSpec }) => {
  const { ask, dialog } = useAdminDialog();
  const [result, setResult] = useState<string>('');
  return (
    <div>
      <button type="button" onClick={async () => setResult(JSON.stringify(await ask(spec)))}>열기</button>
      <output>{result}</output>
      {dialog}
    </div>
  );
};

describe('useAdminDialog — window.prompt 대신', () => {
  it('레이블이 붙은 칸, 필수 검증은 창 안에 띄우고 닫지 않는다, 확인하면 값을 돌려준다', async () => {
    render(<Harness spec={{ title: '반려', description: '사유가 메일로 갑니다.', fields: [{ name: 'reason', label: '반려 사유', type: 'textarea', required: '사유를 적어 주세요.' }], confirmLabel: '반려', tone: 'danger' }} />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    const dialog = screen.getByRole('dialog', { name: '반려' });
    expect(dialog).toHaveTextContent('사유가 메일로 갑니다.');
    fireEvent.click(within(dialog).getByRole('button', { name: '반려' }));
    expect(within(dialog).getByText('사유를 적어 주세요.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/반려 사유/), { target: { value: '요건 미충족' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '반려' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('{"reason":"요건 미충족"}')).toBeInTheDocument();
  });

  it('취소하면 null', async () => {
    render(<Harness spec={{ title: '이체 기록', fields: [{ name: 'memo', label: '메모', defaultValue: '기본값' }] }} />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(screen.getByLabelText('메모')).toHaveValue('기본값');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.getByText('null')).toBeInTheDocument());
  });

  it('onSubmit이 실패 문구를 돌려주면 창을 연 채 그 문구를 띄운다', async () => {
    const onSubmit = jest.fn().mockResolvedValueOnce('서버가 거절했습니다.').mockResolvedValueOnce(null);
    render(<Harness spec={{ title: '무효', fields: [{ name: 'reason', label: '사유', required: true }], onSubmit }} />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    fireEvent.change(screen.getByLabelText(/사유/), { target: { value: '중복 기록' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('서버가 거절했습니다.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onSubmit).toHaveBeenCalledWith({ reason: '중복 기록' });
  });
});
