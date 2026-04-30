import { render } from '@testing-library/react';
import GradientOrb from '../GradientOrb';

describe('GradientOrb', () => {
  it('지정한 color prop의 hex가 inline style background에 들어간다', () => {
    const { container } = render(<GradientOrb color="mint" size={400} />);
    const div = container.firstChild as HTMLElement;
    // jsdom normalizes #a7e5d3 → rgb(167, 229, 211); check rgb equivalent
    expect(div.style.background).toContain('167, 229, 211');
  });

  it('default opacity는 0.4, blur는 120px이다', () => {
    const { container } = render(<GradientOrb color="peach" size={300} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.opacity).toBe('0.4');
    expect(div.style.filter).toContain('blur(120px)');
  });

  it('aria-hidden=true', () => {
    const { container } = render(<GradientOrb color="lavender" size={200} />);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('aria-hidden')).toBe('true');
  });
});
