import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

export const useAudioPlayer = (tracks) => {
    const [currentTrack, setCurrentTrack] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const audioRef = useRef(null);
    const progressBarRef = useRef(null);
    const animationRef = useRef(null);
    const router = useRouter();

    // Initialize audioRef lazily to avoid hydration mismatch or issues during SSR
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        audioRef.current = new Audio(tracks[currentTrack].src);
    }, [currentTrack]);

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
            progressBarRef.current.value = audioRef.current.currentTime;
            setCurrentTime(audioRef.current.currentTime);
            animationRef.current = requestAnimationFrame(whilePlaying);
        }
    }, []);

    // Load and setup audio when track changes
    useEffect(() => {
        if (!audioRef.current) return;

        const audio = audioRef.current;
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

    // Handle play/pause
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

    // Stop playback on route change
    useEffect(() => {
        stopPlayback();
    }, [router.asPath, stopPlayback]);

    // Cleanup on unmount
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
        if (audioRef.current) {
            audioRef.current.currentTime = progressBarRef.current.value;
            setCurrentTime(progressBarRef.current.value);
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

    const changeVolume = (e) => {
        let value;
        if (e.target.tagName !== 'INPUT') {
            const rect = e.target.getBoundingClientRect();
            const clickPosition = e.clientX - rect.left;
            value = clickPosition / rect.width;
            value = Math.max(0, Math.min(1, value));
        } else {
            value = e.target.value;
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

    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return {
        // State
        currentTrack,
        isPlaying,
        duration,
        currentTime,
        volume,
        isMuted,
        isExpanded,

        // Refs
        progressBarRef,

        // Actions
        playPause,
        nextTrack,
        prevTrack,
        changeRange,
        changeVolume,
        toggleMute,
        toggleExpand,
        formatTime,

        // Computed
        progress: duration ? (currentTime / duration) * 100 : 0,
        track: tracks[currentTrack],
    };
};
