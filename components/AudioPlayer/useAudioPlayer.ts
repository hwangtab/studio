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
    const animationRef = useRef<number | null>(null);
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
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    const whilePlaying = useCallback(() => {
        if (!isMounted.current) return;
        if (progressBarRef.current && audioRef.current) {
            progressBarRef.current.value = String(audioRef.current.currentTime);
            setCurrentTime(audioRef.current.currentTime);
            animationRef.current = requestAnimationFrame(whilePlaying);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !tracks || tracks.length === 0) return;

        let isEffectMounted = true;

        if (!audioRef.current) {
            audioRef.current = new Audio(tracks[currentTrack].src);
        }

        const audio = audioRef.current;

        // Sync volume and mute state
        audio.volume = isMuted ? 0 : volume;

        // If track changed, reset and load
        if (audio.src !== new URL(tracks[currentTrack].src, window.location.href).href) {
            audio.pause();
            audio.src = tracks[currentTrack].src;
            audio.load();
        }

        const setAudioData = () => {
            if (isEffectMounted && isMounted.current) {
                setDuration(audio.duration);
                setCurrentTime(audio.currentTime);
            }
        };

        const setAudioTime = () => {
            if (isEffectMounted && isMounted.current) {
                setCurrentTime(audio.currentTime);
            }
        };

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);

        // Handle playback
        if (isPlaying) {
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise
                    .then(() => {
                        if (isEffectMounted && isMounted.current) {
                            if (animationRef.current) cancelAnimationFrame(animationRef.current);
                            animationRef.current = requestAnimationFrame(whilePlaying);
                        }
                    })
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
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        }

        return () => {
            isEffectMounted = false;
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
        };
    }, [currentTrack, tracks, isPlaying, whilePlaying, volume, isMuted]);

    useEffect(() => {
        stopPlayback();
    }, [router.pathname, stopPlayback]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, []);

    const changeRange = () => {
        if (audioRef.current && progressBarRef.current) {
            audioRef.current.currentTime = Number(progressBarRef.current.value);
            setCurrentTime(Number(progressBarRef.current.value));
        }
    };

    const playPause = () => {
        setIsPlaying(!isPlaying);
    };

    const nextTrack = () => {
        setCurrentTrack((prev) => (prev + 1) % tracks.length);
        setIsPlaying(true);
    };

    const prevTrack = () => {
        setCurrentTrack((prev) => (prev - 1 + tracks.length) % tracks.length);
        setIsPlaying(true);
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
