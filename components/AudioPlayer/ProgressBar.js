import React from 'react';

const ProgressBar = ({ currentTime, duration, progress, progressBarRef, onChangeRange, formatTime }) => {
    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <span className="typo-card-meta text-white/80">{formatTime(currentTime)}</span>
                <span className="typo-card-meta text-white/80">{formatTime(duration)}</span>
            </div>
            <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
                <input
                    type="range"
                    ref={progressBarRef}
                    defaultValue="0"
                    onChange={onChangeRange}
                    max={duration || 0}
                    className="absolute inset-0 w-full h-full appearance-none bg-transparent z-10 opacity-0 cursor-pointer"
                />
                <div
                    className="absolute top-0 left-0 h-full bg-white/60 rounded-full"
                    style={{ width: `${progress}%` }}
                ></div>
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md pointer-events-none"
                    style={{ left: `calc(${progress}% - 8px)`, display: progress > 0 ? 'block' : 'none' }}
                ></div>
            </div>
        </div>
    );
};

export default ProgressBar;
