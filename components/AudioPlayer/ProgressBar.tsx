import React from 'react';

interface ProgressBarProps {
    currentTime: number;
    duration: number;
    progress: number;
    progressBarRef: React.MutableRefObject<HTMLInputElement | null>;
    onChangeRange: () => void;
    formatTime: (time: number) => string;
}

const ProgressBar = ({ currentTime, duration, progress, progressBarRef, onChangeRange, formatTime }: ProgressBarProps) => {
    return (
        <div className="w-full">
            <div className="relative h-1.5 w-full bg-gray-200 dark:bg-white/10 rounded-full group cursor-pointer mb-2">
                <input
                    type="range"
                    ref={progressBarRef}
                    defaultValue="0"
                    onChange={onChangeRange}
                    max={duration || 0}
                    aria-label="Playback progress"
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-full"
                />

                {/* Background Track */}
                <div className="absolute inset-0 bg-gray-100 dark:bg-white/5 rounded-full" />

                {/* Progress Fill with Glow */}
                <div
                    className="absolute top-0 left-0 h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.7)] transition-[width] duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />

                {/* Handle (visible on hover or interaction) */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-800 dark:bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none z-10"
                    style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                />
            </div>

            <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-mono font-medium text-gray-400 dark:text-white/50 tracking-wider">
                    {formatTime(currentTime)}
                </span>
                <span className="text-[10px] font-mono font-medium text-gray-400 dark:text-white/50 tracking-wider">
                    {formatTime(duration)}
                </span>
            </div>
        </div>
    );
};

export default ProgressBar;
