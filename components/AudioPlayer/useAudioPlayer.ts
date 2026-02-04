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
    const [isExpanded, setIsExpanded] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressBarRef = useRef<HTMLInputElement>(null);
    const animationRef = useRef<number | null>(null);
    const router = useRouter();

    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    const whilePlaying = useCallback(() => {
        if (progressBarRef.current && audioRef.current) {
            progressBarRef.current.value = String(audioRef.current.currentTime);
            setCurrentTime(audioRef.current.currentTime);
            animationRef.current = requestAnimationFrame(whilePlaying);
        }
    }, []);

    useEffect(() => {
        if (!audioRef.current && tracks && tracks.length > 0) {
            audioRef.current = new Audio(tracks[currentTrack].src);
        }

        if (!audioRef.current) return;

        const audio = audioRef.current;

        audio.pause();
        audio.currentTime = 0;

        audio.src = tracks[currentTrack].src;
        audio.load();

        const setAudioData = () => {
            setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };

        const setAudioTime = () => {
            setCurrentTime(audio.currentTime);
        };

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);

        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
        };
    }, [currentTrack, tracks]);

    useEffect(() => {
        if (!audioRef.current) return;

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        if (isPlaying) {
            const playPromise = audioRef.current.play();

            if (playPromise && typeof playPromise.then === 'function') {
                playPromise
                    .then(() => {
                        animationRef.current = requestAnimationFrame(whilePlaying);
                    })
                    .catch((error) => {
                        console.error('오디오 재생 오류:', error);
                        setIsPlaying(false);
                    });
            } else {
                animationRef.current = requestAnimationFrame(whilePlaying);
            }
        } else {
            audioRef.current.pause();
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, currentTrack, whilePlaying]);

    useEffect(() => {
        stopPlayback();
    }, [router.asPath, stopPlayback]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
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

    const changeVolume = (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLDivElement>) => {
        let value: number;
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const clickPosition = (e as React.MouseEvent).clientX - rect.left;
            value = clickPosition / rect.width;
            value = Math.max(0, Math.min(1, value));
        } else {
            value = Number((e.target as HTMLInputElement).value);
        }

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

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return {
        currentTrack,
        isPlaying,
        duration,
        currentTime,
        volume,
        isMuted,
        isExpanded,

        progressBarRef,

        playPause,
        nextTrack,
        prevTrack,
        changeRange,
        changeVolume,
        toggleMute,
        toggleExpand,
        formatTime,

        selectTrack: (index: number) => {
            setCurrentTrack(index);
            setIsPlaying(true);
        },
        progress: duration ? (currentTime / duration) * 100 : 0,
        track: tracks[currentTrack],
    };
};
