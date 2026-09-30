import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import HomeMixCompare from './HomeMixCompare';
import { getMixCompareCopy, MIX_COMPARE_SOURCES } from '../../data/mixCompare';
import { trackMicroEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({ trackMicroEvent: jest.fn(), trackLeadEvent: jest.fn() }));

/** 브라우저 Audio의 필요한 부분만 흉내 낸다 — 네트워크 없음, 재생 위치는 테스트가 직접 움직인다. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  src = '';
  preload = 'auto';
  currentTime = 0;
  readyState = 4;
  paused = true;
  playCalls = 0;
  loadCalls = 0;
  playImpl: () => Promise<void> = () => Promise.resolve();
  private listeners = new Map<string, Array<() => void>>();
  constructor() { FakeAudio.instances.push(this); }
  addEventListener(type: string, fn: () => void, opts?: { once?: boolean }) {
    const wrapped = opts?.once ? () => { this.removeEventListener(type, wrapped); fn(); } : fn;
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), wrapped]);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }
  emit(type: string) { (this.listeners.get(type) ?? []).slice().forEach((fn) => fn()); }
  play() { this.playCalls += 1; return this.playImpl().then(() => { this.paused = false; }); }
  pause() { this.paused = true; }
  load() { this.loadCalls += 1; }
  removeAttribute() { this.src = ''; }
}

const copy = getMixCompareCopy('ko');
const before = () => FakeAudio.instances.find((a) => a.src === MIX_COMPARE_SOURCES.before)!;
const after = () => FakeAudio.instances.find((a) => a.src === MIX_COMPARE_SOURCES.after)!;

beforeEach(() => {
  FakeAudio.instances = [];
  (global as unknown as { Audio: typeof FakeAudio }).Audio = FakeAudio;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  (trackMicroEvent as jest.Mock).mockClear();
});
afterEach(() => jest.restoreAllMocks());

const mount = () => render(<HomeMixCompare locale="ko" copy={copy} portfolioHref="/ko/portfolio" />);
const clickPlay = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.play })); }); };

describe('HomeMixCompare', () => {
  it('재생을 누르기 전에는 아무것도 내려받지 않는다 — preload none, load 호출 없음', () => {
    mount();
    expect(FakeAudio.instances).toHaveLength(2);
    FakeAudio.instances.forEach((a) => {
      expect(a.preload).toBe('none');
      expect(a.loadCalls).toBe(0);
      expect(a.playCalls).toBe(0);
    });
  });

  it('재생하면 믹싱 전이 재생되고, 반대편 음원을 미리 받는다(전환 끊김 완화)', async () => {
    mount();
    await clickPlay();
    expect(before().playCalls).toBe(1);
    expect(after().playCalls).toBe(0);
    expect(after().preload).toBe('auto');
    expect(after().loadCalls).toBe(1);
    expect(screen.getByRole('button', { name: copy.pause })).toBeInTheDocument();
  });

  it('전환하면 재생 위치를 그대로 넘기고, 새 소리가 시작한 뒤에 이전 소리를 멈춘다', async () => {
    mount();
    await clickPlay();
    before().currentTime = 73.4;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.after })); });
    expect(after().currentTime).toBe(73.4);
    expect(after().playCalls).toBe(1);
    expect(before().paused).toBe(true);
    expect(after().paused).toBe(false);
    expect(screen.getByRole('button', { name: copy.after })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: copy.before })).toHaveAttribute('aria-pressed', 'false');
  });

  it('멈춘 상태에서 전환해도 위치는 넘기되 재생하지 않는다', async () => {
    mount();
    fireEvent.change(screen.getByRole('slider', { name: copy.position }), { target: { value: '120' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.after })); });
    expect(after().currentTime).toBe(120);
    expect(after().playCalls).toBe(0);
  });

  it('메타데이터가 아직 없으면 준비되는 대로 위치를 옮긴다 — iOS는 그 전의 currentTime 설정을 무시한다', async () => {
    mount();
    await clickPlay();
    after().readyState = 0;
    before().currentTime = 40;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.after })); });
    expect(after().currentTime).toBe(0); // 아직 못 옮김
    after().readyState = 1;
    act(() => after().emit('loadedmetadata'));
    expect(after().currentTime).toBe(40);
  });

  it('슬라이더로 옮기면 지금 듣는 음원의 위치가 바뀐다', async () => {
    mount();
    await clickPlay();
    fireEvent.change(screen.getByRole('slider', { name: copy.position }), { target: { value: '200' } });
    expect(before().currentTime).toBe(200);
    expect(screen.getByText('3:20')).toBeInTheDocument();
  });

  it('끝까지 재생하면 멈추고 처음으로 돌아간다', async () => {
    mount();
    await clickPlay();
    before().currentTime = 305;
    act(() => before().emit('ended'));
    expect(screen.getByRole('button', { name: copy.play })).toBeInTheDocument();
    expect(before().currentTime).toBe(0);
    expect(after().currentTime).toBe(0);
  });

  it('재생이 거부되면(자동재생 정책·네트워크) 오류 문구를 보이고 재생 상태로 두지 않는다', async () => {
    mount();
    before().playImpl = () => Promise.reject(new Error('NotAllowedError'));
    await clickPlay();
    expect(screen.getByRole('status')).toHaveTextContent(copy.error);
    expect(screen.getByRole('button', { name: copy.play })).toBeInTheDocument();
  });

  it('음원 로딩 오류(error 이벤트)도 같은 문구를 보인다', async () => {
    mount();
    await clickPlay();
    act(() => before().emit('error'));
    expect(screen.getByRole('status')).toHaveTextContent(copy.error);
    expect(screen.getByRole('button', { name: copy.play })).toBeInTheDocument();
  });

  it('계측: 처음 재생은 한 번, 전환은 매번 — 리드가 아니라 마이크로 이벤트', async () => {
    mount();
    await clickPlay();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.pause })); });
    await clickPlay();
    const calls = (trackMicroEvent as jest.Mock).mock.calls.map((c) => [c[0], c[1].cta_id]);
    expect(calls.filter(([, id]) => id === 'mix_compare_play')).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.after })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.before })); });
    const switches = (trackMicroEvent as jest.Mock).mock.calls.filter((c) => c[1].cta_id === 'mix_compare_switch');
    expect(switches.map((c) => c[1].side)).toEqual(['after', 'before']);
    expect(calls.every(([name]) => name === 'micro_mix_compare')).toBe(true);
  });

  it('언마운트하면 재생을 멈추고 음원 연결을 끊는다 — 다른 페이지로 넘어가도 소리가 남지 않게', async () => {
    const { unmount } = mount();
    await clickPlay();
    const [a, b] = FakeAudio.instances;
    unmount();
    expect(a.paused).toBe(true);
    expect(b.paused).toBe(true);
    expect(a.src).toBe('');
  });

  it('전환 결과를 스크린리더에 알린다', async () => {
    mount();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.after })); });
    expect(screen.getByRole('status')).toHaveTextContent(copy.switchedTo.after);
  });
});
