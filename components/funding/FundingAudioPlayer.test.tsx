import { fireEvent, render, screen } from '@testing-library/react';

import FundingAudioPlayer from './FundingAudioPlayer';

const play = jest.fn().mockResolvedValue(undefined);
const pause = jest.fn();

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  // jsdom에는 canvas 2D 컨텍스트가 없다.
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => jest.restoreAllMocks());

it('모르는 id면 아무것도 그리지 않는다', () => {
  const { container } = render(<FundingAudioPlayer id="nope" />);
  expect(container).toBeEmptyDOMElement();
});

it('곡 제목과 재생 버튼을 그리고, 누르면 재생한다', async () => {
  render(<FundingAudioPlayer id="sabbaha-kalpa" />);
  expect(screen.getByText('Kalpa')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Kalpa 재생/ }));
  await Promise.resolve();
  expect(play).toHaveBeenCalled();
});

it('재생 전에는 음원을 받지 않는다(Audio 요소만 만들고 preload=none)', () => {
  const created: HTMLAudioElement[] = [];
  const Orig = window.Audio;
  window.Audio = function MockAudio(this: unknown) {
    const el = new Orig();
    created.push(el);
    return el;
  } as unknown as typeof Audio;
  render(<FundingAudioPlayer id="sabbaha-kalpa" />);
  window.Audio = Orig;
  expect(created[0].preload).toBe('none');
});
