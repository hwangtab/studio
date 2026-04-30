/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('default variant primary는 ink 배경 + pill', () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn.className).toMatch(/bg-ink/);
    expect(btn.className).toMatch(/rounded-pill/);
  });

  it('outline variant는 transparent + hairline border', () => {
    render(<Button variant="outline">A</Button>);
    const btn = screen.getByRole('button', { name: 'A' });
    expect(btn.className).toMatch(/bg-transparent/);
    expect(btn.className).toMatch(/border-hairline/);
  });

  it('onDark variant는 흰 배경 + ink text', () => {
    render(<Button variant="onDark">D</Button>);
    const btn = screen.getByRole('button', { name: 'D' });
    expect(btn.className).toMatch(/bg-white/);
    expect(btn.className).toMatch(/text-ink/);
  });

  it('text variant는 hover underline', () => {
    render(<Button variant="text">T</Button>);
    const btn = screen.getByRole('button', { name: 'T' });
    expect(btn.className).toMatch(/hover:underline/);
  });

  it('disabled 적용 가능', () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled();
  });
});
