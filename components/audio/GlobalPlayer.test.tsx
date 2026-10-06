import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GlobalPlayerProvider, useGlobalPlayer, type GlobalTrack } from './GlobalPlayerProvider';
import { announcePlay } from '../../lib/audio/audioBus';
import { trackMicroEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn(), trackLeadEvent: jest.fn() }));
// 도크는 next/dynamic으로 첫 재생 때 받는다 — 테스트에서는 바로 그린다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('next/dynamic', () => () => require('./GlobalPlayerDock').default);
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: mockPathname, asPath: '/ko', query: {} }) }));
jest.mock('next/image', () => ({ __esModule: true, default: (props: Record<string, unknown>) => React.createElement('img', { alt: '', src: String(props.src) }) }));
let mockPathname = '/[locale]';

/** 브라우저 Audio의 필요한 부분만 — 네트워크 없음. playing/pause 이벤트는 테스트가 직접 쏜다. */
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  src = '';
  preload = 'auto';
  paused = true;
  ended = false;
  currentTime = 0;
  duration = 30;
  playCalls = 0;
  loadCalls = 0;
  constructor() { super(); FakeAudio.instances.push(this); }
  load() { this.loadCalls += 1; }
  async play() { this.playCalls += 1; this.paused = false; this.dispatchEvent(new Event('playing')); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  removeAttribute() { this.src = ''; }
}

const TRACK: GlobalTrack = { id: 'excerpt-test', src: '/audio/test.mp3', title: 'Jai — Fever', subtitle: '스튜디오 놀 기획·녹음·믹싱', component: 'TestSurface', locale: 'ko' };

const Trigger = ({ track = TRACK }: { track?: GlobalTrack }) => {
  const { play, isPlaying } = useGlobalPlayer();
  return (
    <button type="button" onClick={() => void play(track)} aria-pressed={isPlaying(track.id)}>
      trigger
    </button>
  );
};

beforeEach(() => {
  FakeAudio.instances = [];
  (global as unknown as { Audio: typeof FakeAudio }).Audio = FakeAudio;
  (trackMicroEvent as jest.Mock).mockClear();
  mockPathname = '/[locale]';
});

const renderWithProvider = (ui: React.ReactNode) => render(<GlobalPlayerProvider>{ui}</GlobalPlayerProvider>);
const clickTrigger = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'trigger' })); }); };

describe('GlobalPlayerProvider', () => {
  it('재생 전에는 Audio를 만들지도, 도크를 그리지도 않는다', () => {
    renderWithProvider(<Trigger />);
    expect(FakeAudio.instances).toHaveLength(0);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('첫 재생에서 preload=none Audio 하나를 만들고 도크가 뜨며, 계측은 트랙당 한 번이다', async () => {
    renderWithProvider(<Trigger />);
    await clickTrigger();
    expect(FakeAudio.instances).toHaveLength(1);
    const audio = FakeAudio.instances[0];
    expect(audio.preload).toBe('none');
    expect(audio.src).toBe(TRACK.src);
    expect(audio.playCalls).toBe(1);
    expect(screen.getByRole('region', { name: '지금 재생 중' })).toBeInTheDocument();
    expect(screen.getByText('Jai — Fever')).toBeInTheDocument();
    expect(trackMicroEvent).toHaveBeenCalledWith('micro_audio_play', { locale: 'ko', component: 'TestSurface', cta_id: 'excerpt-test' });
    // 같은 트랙 일시정지 → 재생은 다시 세지 않는다.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '일시정지' })); });
    expect(audio.paused).toBe(true);
    await clickTrigger();
    expect(audio.playCalls).toBe(2);
    expect(trackMicroEvent).toHaveBeenCalledTimes(1);
  });

  it('다른 소스(믹싱 비교)가 울리면 멈추고, 아이콘은 오디오 상태를 따라간다', async () => {
    renderWithProvider(<Trigger />);
    await clickTrigger();
    const audio = FakeAudio.instances[0];
    expect(screen.getByRole('button', { name: 'trigger' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => { announcePlay('mix-compare'); });
    expect(audio.paused).toBe(true);
    expect(screen.getByRole('button', { name: 'trigger' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('닫기는 소리를 멈추고 트랙·도크를 비운다', async () => {
    renderWithProvider(<Trigger />);
    await clickTrigger();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '플레이어 닫기' })); });
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('전폭 하단 바가 있는 화면(스토리 상세)에서는 모바일 바를 숨긴다', async () => {
    mockPathname = '/[locale]/stories/[id]';
    renderWithProvider(<Trigger />);
    await clickTrigger();
    expect(screen.getByRole('region', { name: '지금 재생 중' }).className).toMatch(/\bhidden lg:block\b/);
  });
});
