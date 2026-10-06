/** @jest-environment jsdom */
import { announcePlay, onOtherPlay } from './audioBus';

describe('audioBus — 한 번에 하나만 운다', () => {
  it('다른 소스가 재생을 알리면 콜백이 불리고, 자기 소스는 무시한다', () => {
    const cb = jest.fn();
    const off = onOtherPlay('global', cb);
    announcePlay('mix-compare');
    announcePlay('global');
    announcePlay('portfolio-player');
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    announcePlay('mix-compare');
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
