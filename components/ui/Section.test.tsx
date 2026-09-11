import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Section } from './Section';

const classOf = (ui: React.ReactElement) =>
  (render(ui).container.firstElementChild as HTMLElement).className;

describe('Section spacing', () => {
  it('기본은 py-16 md:py-24', () => {
    const cls = classOf(<Section>x</Section>);
    expect(cls).toMatch(/py-16/);
    expect(cls).toMatch(/md:py-24/);
  });

  it('tight는 py-10 md:py-12', () => {
    const cls = classOf(<Section spacing="tight">x</Section>);
    expect(cls).toMatch(/py-10/);
    expect(cls).toMatch(/md:py-12/);
    expect(cls).not.toMatch(/py-16/);
  });

  it('loose는 py-20 md:py-32', () => {
    const cls = classOf(<Section spacing="loose">x</Section>);
    expect(cls).toMatch(/py-20/);
    expect(cls).toMatch(/md:py-32/);
  });

  it('container=false면 컨테이너 div를 만들지 않는다', () => {
    const { container } = render(<Section container={false}><span data-testid="c" /></Section>);
    expect(container.querySelector('.container')).toBeNull();
  });
});
