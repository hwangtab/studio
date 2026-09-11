import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Field, TextInput, TextArea, fieldControlClass } from './Field';

describe('Field', () => {
  it('레이블을 컨트롤에 연결한다', () => {
    render(
      <Field id="name" label="이름">
        <TextInput id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
  });

  it('required면 시각적 * 표시와 aria-required를 함께 준다', () => {
    render(
      <Field id="email" label="이메일" required>
        <TextInput id="email" />
      </Field>,
    );
    const input = screen.getByLabelText(/이메일/);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('error가 있으면 메시지를 보여주고 aria-invalid·aria-describedby를 연결한다', () => {
    render(
      <Field id="email" label="이메일" error="이메일 형식이 아닙니다">
        <TextInput id="email" />
      </Field>,
    );
    const input = screen.getByLabelText('이메일');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('email-error');
    expect(screen.getByRole('alert')).toHaveTextContent('이메일 형식이 아닙니다');
  });

  it('hint가 있으면 aria-describedby에 함께 들어간다', () => {
    render(
      <Field id="phone" label="연락처" hint="숫자만 입력하세요">
        <TextInput id="phone" />
      </Field>,
    );
    const input = screen.getByLabelText('연락처');
    expect(input.getAttribute('aria-describedby')).toContain('phone-hint');
    expect(screen.getByText('숫자만 입력하세요')).toBeInTheDocument();
  });

  it('error와 hint가 함께 있으면 둘 다 describedby에 들어간다', () => {
    render(
      <Field id="phone" label="연락처" hint="숫자만" error="필수입니다">
        <TextInput id="phone" />
      </Field>,
    );
    const describedBy = screen.getByLabelText('연락처').getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('phone-hint');
    expect(describedBy).toContain('phone-error');
  });

  it('컨트롤 클래스가 정본 반경·포커스 규칙을 따른다', () => {
    expect(fieldControlClass).toMatch(/rounded-lg/);
    expect(fieldControlClass).toMatch(/focus-visible:ring-2/);
    expect(fieldControlClass).toMatch(/dark:/);
    expect(fieldControlClass).not.toMatch(/\bfocus:ring/); // focus-visible만 쓴다
  });

  it('TextArea도 같은 컨트롤 클래스를 쓴다', () => {
    render(<TextArea id="msg" aria-label="메시지" />);
    expect(screen.getByLabelText('메시지').className).toMatch(/rounded-lg/);
  });

  it('invalid면 컨트롤에 오류 테두리가 붙는다', () => {
    render(<TextInput id="x" aria-label="x" invalid />);
    expect(screen.getByLabelText('x').className).toMatch(/border-red-500/);
  });

  it('자식이 생짜 <input>이면 invalid를 DOM에 새지 않고 aria-invalid만 배선한다', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Field id="native" label="네이티브" error="오류">
        <input />
      </Field>,
    );
    const input = screen.getByLabelText('네이티브');
    expect(input.getAttribute('invalid')).toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('자식이 TextInput이면 기존대로 오류 테두리가 적용된다(회귀 방지)', () => {
    render(
      <Field id="ctl" label="컨트롤" error="오류">
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText('컨트롤').className).toMatch(/border-red-500/);
  });
});
