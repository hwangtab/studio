import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import type { AudioTrack } from '../../types/data';

export const useAudioPlayer = (tracks: readonly AudioTrack[]) => {
    const [currentTrack, setCurrentTrack] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);

    const isMounted = useRef(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressBarRef = useRef<HTMLInputElement>(null);
    // 사용자가 시크바를 드래그하는 동안(pointerdown~pointerup) true. timeupdate가 이
    // 구간에 progressBarRef.value를 실제 재생 위치로 되돌려 쓰면 드래그와 다투므로,
    // 드래그 중에는 아래 setAudioTime의 슬라이더 갱신을 건너뛴다(React state가 아니라
    // ref인 이유: 값이 바뀔 때마다 리렌더가 필요 없고, timeupdate 콜백이 매번 최신
    // 값을 동기적으로 읽어야 한다).
    const isSeekingRef = useRef(false);
    const router = useRouter();

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            if (isMounted.current) {
                setIsPlaying(false);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !tracks || tracks.length === 0) return;

        let isEffectMounted = true;

        if (!audioRef.current) {
            audioRef.current = new Audio(tracks[currentTrack].src);
            // preload='none' — 사용자가 재생 버튼을 누를 때까지 파일을 다운로드하지 않음.
            // 기본값 'auto'면 3MB+ 오디오가 페이지 로드 즉시 다운로드되어 LCP/대역폭을
            // 잠식(/ko/portfolio LCP 21s 사고 원인).
            audioRef.current.preload = 'none';
        }

        const audio = audioRef.current;

        // If track changed, reset and load (재생 중이거나 사용자가 트랙 바꿨을 때만 load).
        if (audio.src !== new URL(tracks[currentTrack].src, window.location.href).href) {
            audio.pause();
            audio.src = tracks[currentTrack].src;
            // 트랙 교체 직후에도 preload='none' 유지 — 재생 버튼 누르면 자동으로 가져옴.
            audio.preload = 'none';
            if (isPlaying) audio.load();
        }

        const setAudioData = () => {
            if (isEffectMounted && isMounted.current) {
                setDuration(audio.duration);
                setCurrentTime(audio.currentTime);
                if (progressBarRef.current) {
                    progressBarRef.current.value = String(audio.currentTime);
                }
            }
        };

        const setAudioTime = () => {
            if (isEffectMounted && isMounted.current) {
                setCurrentTime(audio.currentTime);
                // 드래그 중에는 슬라이더 값을 재생 위치로 되돌려 쓰지 않는다 — 그러지
                // 않으면 timeupdate(수백ms 주기)가 사용자가 끌고 있는 값을 실제 재생
                // 위치로 매번 덮어써 드래그가 튕기는 것처럼 보인다.
                if (progressBarRef.current && !isSeekingRef.current) {
                    progressBarRef.current.value = String(audio.currentTime);
                }
            }
        };

        const handleEnded = () => {
            if (isEffectMounted && isMounted.current) {
                setIsPlaying(false);
            }
        };

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        // Handle playback
        if (isPlaying) {
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise
                    .then(() => undefined)
                    .catch((error) => {
                        if (error.name === 'AbortError') return;
                        console.error('Audio playback error:', error);
                        if (isEffectMounted && isMounted.current) {
                            setIsPlaying(false);
                        }
                    });
            }
        } else {
            audio.pause();
        }

        return () => {
            isEffectMounted = false;
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentTrack, tracks, isPlaying]);

    useEffect(() => {
        if (!audioRef.current) return;
        audioRef.current.volume = isMuted ? 0 : volume;
    }, [volume, isMuted]);

    useEffect(() => {
        if (!router?.events) return;

        const handleRouteChangeStart = () => {
            stopPlayback();
        };

        router.events.on('routeChangeStart', handleRouteChangeStart);
        router.events.on('hashChangeStart', handleRouteChangeStart);

        return () => {
            router.events.off('routeChangeStart', handleRouteChangeStart);
            router.events.off('hashChangeStart', handleRouteChangeStart);
        };
    }, [router.events, stopPlayback]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const changeRange = () => {
        if (audioRef.current && progressBarRef.current) {
            audioRef.current.currentTime = Number(progressBarRef.current.value);
            setCurrentTime(Number(progressBarRef.current.value));
        }
    };

    // ProgressBar의 pointerdown/mousedown~pointerup/mouseup(또는 touch 등가물)에 배선.
    // 드래그 구간 동안 timeupdate의 슬라이더 갱신을 억제한다(위 setAudioTime 참고).
    const startSeeking = () => {
        isSeekingRef.current = true;
    };

    const endSeeking = () => {
        isSeekingRef.current = false;
        // 드래그를 놓은 시점에 슬라이더가 실제 재생 위치와 어긋나 있지 않도록 즉시 동기화.
        if (progressBarRef.current && audioRef.current) {
            progressBarRef.current.value = String(audioRef.current.currentTime);
        }
    };

    const playPause = () => {
        setIsPlaying((prev) => !prev);
    };

    const nextTrack = () => {
        setCurrentTrack((prev) => (prev + 1) % tracks.length);
    };

    const prevTrack = () => {
        setCurrentTrack((prev) => (prev - 1 + tracks.length) % tracks.length);
    };

    const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        setVolume(value);
        if (audioRef.current) {
            audioRef.current.volume = value;
        }
        setIsMuted(value === 0);
    };

    const toggleMute = () => {
        if (audioRef.current) {
            if (isMuted) {
                audioRef.current.volume = volume;
                setIsMuted(false);
            } else {
                audioRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return {
        currentTrack,
        isPlaying,
        duration,
        currentTime,
        volume,
        isMuted,

        progressBarRef,

        playPause,
        nextTrack,
        prevTrack,
        changeRange,
        startSeeking,
        endSeeking,
        changeVolume,
        toggleMute,
        formatTime,

        selectTrack: (index: number) => {
            setCurrentTrack(index);
            setIsPlaying(true);
        },
        progress: duration ? (currentTime / duration) * 100 : 0,
        track: tracks[currentTrack],
    };
};
