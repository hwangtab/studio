import { act, renderHook, waitFor } from '@testing-library/react';
import { useAudioPlayer } from './useAudioPlayer';
import type { AudioTrack } from '../../types/data';

const useRouterMock = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => useRouterMock(),
}));

type RouteEventHandler = (...args: unknown[]) => void;

const createRouterEvents = () => {
  const handlers: Record<string, Set<RouteEventHandler>> = {};

  return {
    on: (event: string, handler: RouteEventHandler) => {
      if (!handlers[event]) {
        handlers[event] = new Set<RouteEventHandler>();
      }
      handlers[event].add(handler);
    },
    off: (event: string, handler: RouteEventHandler) => {
      handlers[event]?.delete(handler);
    },
    emit: (event: string, ...args: unknown[]) => {
      handlers[event]?.forEach((handler) => handler(...args));
    },
  };
};

class MockAudio {
  static instances: MockAudio[] = [];

  src: string;
  duration = 120;
  currentTime = 0;
  volume = 1;
  pause = jest.fn();
  play = jest.fn().mockResolvedValue(undefined);
  load = jest.fn();

  private listeners = new Map<string, Set<() => void>>();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }

  addEventListener = jest.fn((event: string, handler: () => void) => {
    const existing = this.listeners.get(event) || new Set<() => void>();
    existing.add(handler);
    this.listeners.set(event, existing);
  });

  removeEventListener = jest.fn((event: string, handler: () => void) => {
    this.listeners.get(event)?.delete(handler);
  });
}

const TRACKS: AudioTrack[] = [
  {
    id: 'track-1',
    title: 'Track 1',
    artist: 'Artist 1',
    src: 'https://example.com/audio/track-1.mp3',
    albumArt: 'https://example.com/audio/track-1.jpg',
    duration: '02:00',
    featured: true,
    description: 'desc',
  },
];

describe('useAudioPlayer route change behavior', () => {
  const OriginalAudio = global.Audio;

  beforeEach(() => {
    jest.clearAllMocks();
    MockAudio.instances = [];
    const events = createRouterEvents();
    useRouterMock.mockReturnValue({
      pathname: '/[locale]/portfolio',
      asPath: '/ko/portfolio',
      events,
    });
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  afterAll(() => {
    global.Audio = OriginalAudio;
  });

  it('stops playback when route change starts (including same-page query changes)', async () => {
    const router = useRouterMock();
    const { result } = renderHook(() => useAudioPlayer(TRACKS));

    act(() => {
      result.current.playPause();
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });

    const audioInstance = MockAudio.instances[0];
    expect(audioInstance).toBeDefined();

    act(() => {
      router.events.emit('routeChangeStart', '/ko/portfolio?item=track-1', { shallow: true });
    });

    await waitFor(() => {
      expect(result.current.isPlaying).toBe(false);
    });
    expect(audioInstance.pause).toHaveBeenCalled();
  });
});

describe('useAudioPlayer seek vs timeupdate race', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockAudio.instances = [];
    const events = createRouterEvents();
    useRouterMock.mockReturnValue({
      pathname: '/[locale]/portfolio',
      asPath: '/ko/portfolio',
      events,
    });
    global.Audio = MockAudio as unknown as typeof Audio;
  });

  it('does not let a timeupdate overwrite the progress bar value while the user is seeking', () => {
    const { result } = renderHook(() => useAudioPlayer(TRACKS));

    // jsdom HTMLInputElement는 실사용 가능하므로 progressBarRef에 실제 input을 붙인다.
    const input = document.createElement('input');
    input.type = 'range';
    act(() => {
      result.current.progressBarRef.current = input;
    });

    const audioInstance = MockAudio.instances[0];
    audioInstance.currentTime = 10;

    // 사용자가 드래그를 시작하고 30초로 끌었다고 가정.
    act(() => {
      result.current.startSeeking();
      input.value = '30';
    });

    // 그 사이 재생 위치는 여전히 10초에서 timeupdate가 발생 — 드래그 중에는
    // progressBarRef.value를 되돌려 쓰면 안 된다.
    act(() => {
      audioInstance.addEventListener.mock.calls
        .filter(([event]) => event === 'timeupdate')
        .forEach(([, handler]) => handler());
    });

    expect(input.value).toBe('30');

    // 드래그를 놓으면 실제 재생 위치로 동기화된다.
    act(() => {
      result.current.endSeeking();
    });

    expect(input.value).toBe('10');
  });
});
