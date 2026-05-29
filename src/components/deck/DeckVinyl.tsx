'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { DeckId } from '@/src/store/types';

interface DeckVinylProps {
  deckId: DeckId;
  isPlaying: boolean;
  tempo: number;
  onScratch: (rate: number) => void;
  onReleaseScratch: () => void;
  trackName?: string;
  /** Diameter in px; default 180 */
  vinylSize?: number;
}

export function DeckVinyl({ deckId, isPlaying, tempo, onScratch, onReleaseScratch, trackName, vinylSize = 180 }: DeckVinylProps) {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const lastFrameRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0, time: 0 });
  const centerRef = useRef({ x: 0, y: 0 });
  const vinylRef = useRef<HTMLDivElement>(null);

  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';
  const RPM = 33.33;

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (isPlaying && !isDraggingRef.current) {
        const delta = timestamp - lastFrameRef.current;
        if (lastFrameRef.current > 0) {
          const degreesPerMs = (RPM * 360) / 60000;
          rotationRef.current += degreesPerMs * delta * tempo;
          rotationRef.current = rotationRef.current % 360;
          setRotation(rotationRef.current);
        }
      }
      lastFrameRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, tempo]);

  const getAngle = useCallback((x: number, y: number): number => {
    const dx = x - centerRef.current.x;
    const dy = y - centerRef.current.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!vinylRef.current) return;
    const rect = vinylRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY, time: e.timeStamp };
    e.preventDefault();
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!vinylRef.current) return;
    const rect = vinylRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    isDraggingRef.current = true;
    const t = e.touches[0];
    lastMouseRef.current = { x: t.clientX, y: t.clientY, time: e.timeStamp };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const now = e.timeStamp;
      const dt = now - lastMouseRef.current.time;
      if (dt <= 0) return;

      const prevAngle = getAngle(lastMouseRef.current.x, lastMouseRef.current.y);
      const currAngle = getAngle(e.clientX, e.clientY);
      let angleDelta = currAngle - prevAngle;

      // Handle wrap-around
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;

      rotationRef.current += angleDelta;
      setRotation(rotationRef.current % 360);

      // Convert angular velocity to playback rate
      const angularVelocity = angleDelta / dt; // degrees/ms
      const normalSpeed = (RPM * 360) / 60000; // degrees/ms at 1x
      const rate = angularVelocity / normalSpeed;
      onScratch(rate * 2); // amplify scratch sensitivity

      lastMouseRef.current = { x: e.clientX, y: e.clientY, time: now };
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onReleaseScratch();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const now = e.timeStamp;
      const dt = now - lastMouseRef.current.time;
      if (dt <= 0) return;
      const t = e.touches[0];

      const prevAngle = getAngle(lastMouseRef.current.x, lastMouseRef.current.y);
      const currAngle = getAngle(t.clientX, t.clientY);
      let angleDelta = currAngle - prevAngle;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;

      rotationRef.current += angleDelta;
      setRotation(rotationRef.current % 360);

      const angularVelocity = angleDelta / dt;
      const normalSpeed = (RPM * 360) / 60000;
      onScratch((angularVelocity / normalSpeed) * 2);

      lastMouseRef.current = { x: t.clientX, y: t.clientY, time: now };
    };

    const handleTouchEnd = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        onReleaseScratch();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [getAngle, onScratch, onReleaseScratch]);

  const size = vinylSize;
  const center = size / 2;

  return (
    <div
      ref={vinylRef}
      className="relative cursor-grab active:cursor-grabbing select-none"
      style={{ width: size, height: size }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Vinyl disc SVG */}
      <svg
        width={size}
        height={size}
        style={{ transform: `rotate(${rotation}deg)`, display: 'block' }}
      >
        {/* Outer edge */}
        <circle cx={center} cy={center} r={center - 2} fill="#111118" stroke="#2a2a3a" strokeWidth="3" />

        {/* Vinyl grooves */}
        {Array.from({ length: 20 }, (_, i) => {
          const r = 20 + i * 7;
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="#1e1e28"
              strokeWidth="1"
            />
          );
        })}

        {/* Label area */}
        <circle cx={center} cy={center} r={40} fill="#1a1a24" />
        <circle cx={center} cy={center} r={40} fill="none" stroke="#2a2a3a" strokeWidth="1" />

        {/* Label accent rings */}
        <circle cx={center} cy={center} r={38} fill="none" stroke={accentColor} strokeWidth="0.5" opacity="0.5" />
        <circle cx={center} cy={center} r={34} fill="none" stroke={accentColor} strokeWidth="0.3" opacity="0.3" />

        {/* Center spindle */}
        <circle cx={center} cy={center} r={5} fill="#0a0a0f" stroke={accentColor} strokeWidth="1" />

        {/* Reflection highlight */}
        <path
          d={`M ${center - 60} ${center - 30} Q ${center} ${center - 70} ${center + 60} ${center - 30}`}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="20"
          strokeLinecap="round"
        />

        {/* Timing marks */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * 2 * Math.PI;
          const innerR = center - 15;
          const outerR = center - 8;
          return (
            <line
              key={i}
              x1={center + innerR * Math.cos(angle)}
              y1={center + innerR * Math.sin(angle)}
              x2={center + outerR * Math.cos(angle)}
              y2={center + outerR * Math.sin(angle)}
              stroke={accentColor}
              strokeWidth="2"
              opacity="0.6"
            />
          );
        })}
      </svg>

      {/* Track name overlay */}
      {trackName && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${-rotation}deg)` }}
        >
          <span
            className="text-[9px] font-rajdhani font-semibold text-center px-4 leading-tight"
            style={{
              color: accentColor,
              maxWidth: 70,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {trackName}
          </span>
        </div>
      )}

      {/* Playing glow */}
      {isPlaying && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: `0 0 20px ${accentColor}44, 0 0 40px ${accentColor}22`,
          }}
        />
      )}
    </div>
  );
}
