import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InputField from './InputField';
import { User } from '@/lib/lucide-icons';

it('InputField 계약 유지: id·name·value·onChange·required·aria·에러 테두리', () => {
  const onChange = jest.fn();
  render(
    <InputField icon={User} id="name" label="이름" type="text" name="name" value="v"
      onChange={onChange} error="필수입니다" required autoComplete="name" placeholder="ph" />,
  );
  const input = screen.getByLabelText(/^이름\*$/) as HTMLInputElement;
  expect(input.id).toBe('name');
  expect(input.name).toBe('name');
  expect(input.value).toBe('v');
  expect(input.type).toBe('text');
  expect(input.required).toBe(true);
  expect(input.autocomplete).toBe('name');
  expect(input.placeholder).toBe('ph');
  expect(input).toHaveAttribute('aria-required', 'true');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input.getAttribute('aria-describedby')).toContain('name-error');
  expect(input.className).toMatch(/border-red-500/);
  expect(input.className).toMatch(/pl-10/);
  expect(screen.getByRole('alert')).toHaveTextContent('필수입니다');
});
