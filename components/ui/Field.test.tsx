import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Field, TextInput, TextArea, Select, fieldControlClass } from './Field';

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

  // light는 className이 아니라 prop이다 — 문자열로 넘기면 twMerge 순서상
  // dark:border-gray-300이 뒤에 와서 오류 테두리의 dark:border-red-500을 지운다.
  // 관리자·계약 화면에도 <html class="dark">가 붙으므로 실제로 보이는 회귀였다.
  describe('light 옵트인', () => {
    it.each([
      ['TextInput', TextInput],
      ['TextArea', TextArea],
      ['Select', Select],
    ] as const)('%s: light + invalid면 다크 오류 테두리가 살아남는다', (_name, Control) => {
      render(<Control aria-label="ctl" light invalid />);
      const cls = screen.getByLabelText('ctl').className;
      expect(cls).toMatch(/(^|\s)dark:border-red-500(\s|$)/);
      expect(cls).not.toMatch(/dark:border-gray-300/);
      expect(cls).not.toMatch(/dark:border-gray-600/);
    });

    it('light면 다크 배경·글자색이 라이트 값으로 돌아간다', () => {
      render(<TextInput aria-label="ctl" light />);
      const cls = screen.getByLabelText('ctl').className;
      expect(cls).toMatch(/dark:bg-white/);
      expect(cls).toMatch(/dark:text-gray-900/);
      expect(cls).not.toMatch(/dark:bg-gray-800/);
    });

    it('light 없이 invalid면 기본 다크 오류 테두리를 그대로 쓴다', () => {
      render(<TextInput aria-label="ctl" invalid />);
      expect(screen.getByLabelText('ctl').className).toMatch(/dark:border-red-500/);
    });

    it('호출부 className은 light보다 뒤에 와서 이긴다(읽기전용 칸의 회색 배경)', () => {
      render(<TextInput aria-label="ctl" light readOnly className="bg-gray-50 dark:bg-gray-50" />);
      const cls = screen.getByLabelText('ctl').className;
      expect(cls).toMatch(/dark:bg-gray-50/);
      expect(cls).not.toMatch(/dark:bg-white/);
    });

    it('light는 DOM 속성으로 새지 않는다', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      render(<TextInput aria-label="ctl" light />);
      expect(screen.getByLabelText('ctl').getAttribute('light')).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
