import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProductionContractForm, { emptyProductionFormValues, toProductionPayload, type ProductionContractFormValues } from './ProductionContractForm';

const renderForm = () => {
  let latest: ProductionContractFormValues | null = null;
  render(
    <ProductionContractForm
      initialValues={emptyProductionFormValues()}
      submitLabel="저장"
      submitting={false}
      errors={[]}
      onSubmit={() => {}}
      onCancel={() => {}}
      onChange={(values) => {
        latest = values;
      }}
    />,
  );
  return () => latest!;
};

describe('작성 폼 — AI 리워크', () => {
  it('리워크를 고르면 범위 선택이 나오고, 범위마다 금액·분할이 채워진다', () => {
    const values = renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /AI 리워크/ }));
    expect(values().terms.amount).toMatchObject({ total: 500_000, deposit: 500_000, second: 0, balance: 0 });

    fireEvent.click(screen.getByRole('radio', { name: /소편성/ }));
    expect(values().terms.amount).toMatchObject({ total: 1_000_000, deposit: 500_000, second: 300_000, balance: 200_000 });
    expect(screen.getByLabelText(/중간금\(편곡 승인 후\)/)).toHaveValue('300000');

    fireEvent.click(screen.getByRole('radio', { name: /풀밴드/ }));
    expect(values().terms.amount).toMatchObject({ total: 1_500_000, deposit: 750_000, second: 450_000, balance: 300_000 });
    expect(screen.getByText(/받은 금액 × 단계 비율/)).toBeInTheDocument();
    expect(toProductionPayload(values())).toMatchObject({ kind: 'rework' });
  });

  it('계약금액을 고치면 3회 분할과 항목 금액이 따라간다', () => {
    const values = renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /AI 리워크/ }));
    fireEvent.change(screen.getByLabelText(/^계약금액/), { target: { value: '1200000' } });
    expect(values().terms.amount).toMatchObject({ total: 1_200_000, deposit: 600_000, second: 360_000, balance: 240_000 });
    expect(values().terms.refundSchedule[0].amount).toBe(1_200_000);
  });

  it('리워크에서 싱글로 돌아가면 비율 환불이 빠지고 다섯 항목표가 된다', () => {
    const values = renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /AI 리워크/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^싱글/ }));
    expect(values().terms.refundPolicy).toBeUndefined();
    expect(values().terms.refundSchedule).toHaveLength(5);
    expect(values().terms.amount.second).toBe(0);
  });
});
