import React from 'react';

interface ProgressBarProps {
    currentTime: number;
    duration: number;
    progress: number;
    progressBarRef: React.MutableRefObject<HTMLInputElement | null>;
    onChangeRange: () => void;
    formatTime: (time: number) => string;
    ariaLabel?: string;
}

const ProgressBar = ({ currentTime, duration, progress, progressBarRef, onChangeRange, formatTime, ariaLabel = 'Playback progress' }: ProgressBarProps) => {
    return (
        <div className="w-full">
            <div className="relative h-1 w-full bg-ink-muted-40/40 dark:bg-white/15 rounded-pill group cursor-pointer mb-2">
                <input
                    type="range"
                    ref={progressBarRef}
                    defaultValue="0"
                    onChange={onChangeRange}
                    max={duration || 0}
                    aria-label={ariaLabel}
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 rounded-pill"
                />

                {/* Progress Fill */}
                <div
                    className="absolute top-0 left-0 h-full bg-ink dark:bg-white rounded-pill transition-[width] duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                />

                {/* Handle (visible on hover or interaction) */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-ink dark:bg-white rounded-pill shadow-card opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none z-10"
                    style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                />
            </div>

            <div className="flex items-center justify-between px-1">
                <span className="text-caption font-mono text-ink-muted-60 dark:text-on-dark-soft tracking-wider">
                    {formatTime(currentTime)}
                </span>
                <span className="text-caption font-mono text-ink-muted-60 dark:text-on-dark-soft tracking-wider">
                    {formatTime(duration)}
                </span>
            </div>
        </div>
    );
};

export default ProgressBar;
