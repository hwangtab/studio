import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import CustomerContactFields from './CustomerContactFields';
import { useContactValidation } from './useContactValidation';
import type { ContactValues, PhoneRule } from '../../lib/contact/rules';

const onValid = jest.fn();

function Harness({ rule, locale = 'ko' }: { rule?: PhoneRule; locale?: 'ko' | 'en' }) {
  const [values, setValues] = useState<ContactValues>({ customerName: '', customerPhone: '', customerEmail: '' });
  const contact = useContactValidation({ rule, locale });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); if (contact.validate(values)) onValid(values); }}>
      <CustomerContactFields contact={contact} values={values} onChange={(f, v) => setValues((p) => ({ ...p, [f]: v }))} />
      <button type="submit">제출</button>
    </form>
  );
}

beforeEach(() => onValid.mockClear());

describe('CustomerContactFields + useContactValidation', () => {
  it('빈 값 제출 → 요약 한 줄만 알리고, 칸마다 오류, 이름 칸으로 포커스', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '제출' }));
    expect(onValid).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('아래 3개 항목을 확인해 주세요.');
    expect(screen.getByText('이름을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('휴대폰 번호를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('이메일을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^이름/)).toHaveFocus();
    // 오류 문구가 칸에 묶여 있어 포커스가 가면 읽힌다.
    expect(screen.getByLabelText(/^이름/)).toHaveAccessibleDescription('이름을 입력해 주세요.');
  });

  it('휴대폰만 틀리면 그 칸만 오류, 포커스도 휴대폰', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰/), '010-12');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@example.com');
    await user.click(screen.getByRole('button', { name: '제출' }));
    expect(screen.getByLabelText(/^휴대폰/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^이름/)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/^휴대폰/)).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('아래 1개 항목을 확인해 주세요.');
  });

  it('제출 뒤에는 입력할 때 그 칸만 다시 판정한다 — 한 글자로 오류가 사라지지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '제출' }));
    await user.type(screen.getByLabelText(/^이름/), '홍');
    expect(screen.getByText('이름은 2~40자로 적어 주세요.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^이름/), '길동');
    expect(screen.getByLabelText(/^이름/)).not.toHaveAttribute('aria-invalid');
    // 다른 칸 오류는 그대로
    expect(screen.getByText('휴대폰 번호를 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('아래 2개 항목을 확인해 주세요.');
  });

  it('제출 전에는 입력 중에도 오류를 띄우지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(/^휴대폰/), '010');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(/^휴대폰/)).not.toHaveAttribute('aria-invalid');
  });

  it('올바르면 통과하고, 이름 칸은 40자에서 막힌다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByLabelText(/^이름/)).toHaveAttribute('maxLength', '40');
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰/), '010-1234-5678');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@example.com');
    await user.click(screen.getByRole('button', { name: '제출' }));
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('공연 규칙(kr-or-intl)·영어는 해외 번호를 받고 영어로 알린다', async () => {
    const user = userEvent.setup();
    render(<Harness rule="kr-or-intl" locale="en" />);
    await user.type(screen.getByLabelText(/^Name/), 'Jane Doe');
    await user.type(screen.getByLabelText(/^Phone/), '+1 415 555 0100');
    await user.click(screen.getByRole('button', { name: '제출' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please check 1 field below.');
    expect(screen.getByText('Please enter your email address.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Phone/)).not.toHaveAttribute('aria-invalid');
  });
});
