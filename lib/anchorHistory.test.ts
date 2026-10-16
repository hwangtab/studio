/** @jest-environment jsdom */
import { replaceHashPreservingState } from './anchorHistory';

describe('replaceHashPreservingState', () => {
  it('해시만 바꾸고 Next 히스토리 상태(__N·key)는 그대로 둔다', () => {
    window.history.replaceState({ url: '/[locale]/pricing?locale=ko', as: '/ko/pricing', __N: true, key: 'k1' }, '', '/ko/pricing');
    replaceHashPreservingState('special-packages');
    expect(window.location.hash).toBe('#special-packages');
    expect(window.history.state).toMatchObject({ __N: true, key: 'k1', as: '/ko/pricing' });
  });
});
