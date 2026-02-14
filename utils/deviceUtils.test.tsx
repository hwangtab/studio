import React from 'react';
import { render, screen } from '@testing-library/react';
import { useDisableMotionEffects } from './deviceUtils';

const MotionProbe = () => {
  const disableMotionEffects = useDisableMotionEffects();
  return <span data-testid="motion-state">{disableMotionEffects ? 'disabled' : 'enabled'}</span>;
};

describe('useDisableMotionEffects', () => {
  it('enables motion on first render for non-iOS environments', () => {
    render(<MotionProbe />);
    expect(screen.getByTestId('motion-state').textContent).toBe('enabled');
  });
});
