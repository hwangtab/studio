import React from 'react';

const ORB_HEX = {
  mint: '#a7e5d3',
  peach: '#f4c5a8',
  lavender: '#c8b8e0',
  sky: '#a8c8e8',
  rose: '#e8b8c4',
} as const;

export type OrbColor = keyof typeof ORB_HEX;

interface GradientOrbProps {
  color: OrbColor;
  size: number;
  opacity?: number;
  blur?: number;
  className?: string;
  style?: React.CSSProperties;
}

const GradientOrb: React.FC<GradientOrbProps> = ({
  color,
  size,
  opacity = 0.4,
  blur = 120,
  className,
  style,
}) => {
  const hex = ORB_HEX[color];
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: hex,
        backgroundImage: `radial-gradient(circle, ${hex} 0%, transparent 70%)`,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
};

export default GradientOrb;
