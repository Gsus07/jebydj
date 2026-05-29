'use client';

import { useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

interface KnobProps {
  value: number; // 0-1
  onChange: (value: number) => void;
  size?: number;
  label?: string;
  color?: string;
  minAngle?: number; // degrees
  maxAngle?: number; // degrees
  disabled?: boolean;
}

export function Knob({
  value,
  onChange,
  size = 48,
  label,
  color = '#00f5ff',
  minAngle = -135,
  maxAngle = 135,
  disabled = false,
}: KnobProps) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(value);

  const angle = minAngle + value * (maxAngle - minAngle);
  const radius = size / 2 - 3;
  const center = size / 2;

  // Track position for indicator dot
  const angleRad = ((angle - 90) * Math.PI) / 180;
  const dotX = center + (radius - 4) * Math.cos(angleRad);
  const dotY = center + (radius - 4) * Math.sin(angleRad);

  // Arc path for value indicator
  const arcStartAngle = ((minAngle - 90) * Math.PI) / 180;
  const arcEndAngle = ((angle - 90) * Math.PI) / 180;
  const arcRadius = radius - 1;
  const arcX1 = center + arcRadius * Math.cos(arcStartAngle);
  const arcY1 = center + arcRadius * Math.sin(arcStartAngle);
  const arcX2 = center + arcRadius * Math.cos(arcEndAngle);
  const arcY2 = center + arcRadius * Math.sin(arcEndAngle);
  const largeArc = Math.abs(angle - minAngle) > 180 ? 1 : 0;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    e.preventDefault();
  }, [value, disabled]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startValue.current = value;
  }, [value, disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const delta = -(e.touches[0].clientY - startY.current);
    const sensitivity = 200;
    const newValue = Math.max(0, Math.min(1, startValue.current + delta / sensitivity));
    onChange(newValue);
  }, [onChange]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = -(e.clientY - startY.current);
      const sensitivity = 200;
      const newValue = Math.max(0, Math.min(1, startValue.current + delta / sensitivity));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onChange]);

  const handleDoubleClick = useCallback(() => {
    onChange(0.5);
  }, [onChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    const delta = -e.deltaY / 1000;
    onChange(Math.max(0, Math.min(1, value + delta)));
  }, [value, onChange, disabled]);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: 'visible' }}
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="url(#knobGrad)"
            stroke="#2a2a3a"
            strokeWidth="1.5"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
          />

          {/* Track arc (background) */}
          <path
            d={`M ${center + arcRadius * Math.cos(arcStartAngle)} ${center + arcRadius * Math.sin(arcStartAngle)}
               A ${arcRadius} ${arcRadius} 0 1 1 ${center + arcRadius * Math.cos(((maxAngle - 90) * Math.PI) / 180)} ${center + arcRadius * Math.sin(((maxAngle - 90) * Math.PI) / 180)}`}
            fill="none"
            stroke="#2a2a3a"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Value arc */}
          {value > 0.01 && (
            <path
              d={`M ${arcX1} ${arcY1} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${arcX2} ${arcY2}`}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            />
          )}

          {/* Center knob body */}
          <circle
            cx={center}
            cy={center}
            r={radius - 6}
            fill="#1a1a24"
            stroke="#333344"
            strokeWidth="1"
          />

          {/* Indicator line */}
          <line
            x1={center}
            y1={center}
            x2={dotX}
            y2={dotY}
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 2px ${color})` }}
          />

          {/* Indicator dot */}
          <circle
            cx={dotX}
            cy={dotY}
            r="2.5"
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />

          <defs>
            <radialGradient id="knobGrad" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#2a2a3a" />
              <stop offset="100%" stopColor="#0f0f16" />
            </radialGradient>
          </defs>
        </svg>
      </motion.div>
      {label && (
        <span className="text-[10px] font-rajdhani text-muted uppercase tracking-wider">
          {label}
        </span>
      )}
    </div>
  );
}
