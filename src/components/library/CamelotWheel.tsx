'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDJStore } from '@/src/store/useDJStore';

// Camelot wheel: number → {major: key, minor: key}
const CAMELOT: Record<number, { B: string; A: string }> = {
  1:  { B: 'B',   A: 'F#m' },
  2:  { B: 'F#',  A: 'C#m' },
  3:  { B: 'Db',  A: 'Abm' },
  4:  { B: 'Ab',  A: 'Ebm' },
  5:  { B: 'Eb',  A: 'Bbm' },
  6:  { B: 'Bb',  A: 'Fm'  },
  7:  { B: 'F',   A: 'Cm'  },
  8:  { B: 'C',   A: 'Am'  },
  9:  { B: 'G',   A: 'Em'  },
  10: { B: 'D',   A: 'Bm'  },
  11: { B: 'A',   A: 'F#m' },
  12: { B: 'E',   A: 'C#m' },
};

// Map musical key string → camelot position {num, mode}
function keyToCamelot(key: string): { num: number; mode: 'A' | 'B' } | null {
  const k = key.replace('maj', '').replace('min', '').trim();
  const isMinor = key.includes('m') || key.includes('min');
  const mode: 'A' | 'B' = isMinor ? 'A' : 'B';
  for (const [num, entry] of Object.entries(CAMELOT)) {
    const val = entry[mode];
    if (val.toLowerCase().replace('#', '').replace('b', '') === k.toLowerCase().replace('#', '').replace('b', '')) {
      return { num: Number(num), mode };
    }
    if (val.toLowerCase() === k.toLowerCase()) {
      return { num: Number(num), mode };
    }
  }
  return null;
}

function isCompatible(posA: { num: number; mode: 'A' | 'B' }, num: number, mode: 'A' | 'B'): boolean {
  if (posA.num === num && posA.mode === mode) return true;
  // Same number, different mode (relative major/minor)
  if (posA.num === num) return true;
  // Adjacent numbers, same mode
  const diff = Math.abs(posA.num - num);
  if ((diff === 1 || diff === 11) && posA.mode === mode) return true;
  return false;
}

/** Segment color based on position (rainbow-ish) */
function segmentColor(num: number, mode: 'A' | 'B'): string {
  const hue = ((num - 1) / 12) * 360;
  const sat = mode === 'B' ? 60 : 40;
  const light = mode === 'B' ? 32 : 24;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

interface SegmentInfo {
  num: number;
  mode: 'A' | 'B';
  label: string;
  keyName: string;
}

function buildSegments(): SegmentInfo[] {
  const segs: SegmentInfo[] = [];
  for (let n = 1; n <= 12; n++) {
    segs.push({ num: n, mode: 'B', label: `${n}B`, keyName: CAMELOT[n].B });
    segs.push({ num: n, mode: 'A', label: `${n}A`, keyName: CAMELOT[n].A });
  }
  return segs;
}

export function CamelotWheel() {
  const deckA = useDJStore((s) => s.decks.A);
  const deckB = useDJStore((s) => s.decks.B);
  const [hovered, setHovered] = useState<SegmentInfo | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 200;
  const CX = SIZE / 2, CY = SIZE / 2;
  const OUTER_R = 90, INNER_R = 50;

  const posA = deckA.key ? keyToCamelot(deckA.key) : null;
  const posB = deckB.key ? keyToCamelot(deckB.key) : null;

  const segments = buildSegments(); // 24 entries

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const totalSegs = 24;
    const sliceAngle = (Math.PI * 2) / totalSegs;

    segments.forEach((seg, i) => {
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;
      const r1 = seg.mode === 'B' ? INNER_R + (OUTER_R - INNER_R) * 0.45 : INNER_R;
      const r2 = seg.mode === 'B' ? OUTER_R : INNER_R + (OUTER_R - INNER_R) * 0.45;

      // Determine glow state
      const isA = posA && posA.num === seg.num && posA.mode === seg.mode;
      const isB = posB && posB.num === seg.num && posB.mode === seg.mode;
      const compat = (posA && isCompatible(posA, seg.num, seg.mode)) ||
                     (posB && isCompatible(posB, seg.num, seg.mode));
      const isHovered = hovered?.num === seg.num && hovered?.mode === seg.mode;

      let fillColor = segmentColor(seg.num, seg.mode);
      if (isA) fillColor = '#00f5ff44';
      else if (isB) fillColor = '#ff006e44';
      else if (compat) fillColor = `hsl(${((seg.num - 1) / 12) * 360}, 60%, 40%)`;
      if (isHovered) fillColor = '#ffffff22';

      ctx.beginPath();
      ctx.arc(CX, CY, r2, startAngle, endAngle);
      ctx.arc(CX, CY, r1, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = '#2a2a3a';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Glow for deck keys
      if (isA || isB) {
        ctx.shadowColor = isA ? '#00f5ff' : '#ff006e';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Pulse compatible segments
      if (compat && !isA && !isB) {
        ctx.beginPath();
        ctx.arc(CX, CY, r2, startAngle, endAngle);
        ctx.arc(CX, CY, r1, endAngle, startAngle, true);
        ctx.closePath();
        ctx.strokeStyle = `hsl(${((seg.num - 1) / 12) * 360}, 80%, 60%)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      const midAngle = startAngle + sliceAngle / 2;
      const midR = (r1 + r2) / 2;
      const tx = CX + Math.cos(midAngle) * midR;
      const ty = CY + Math.sin(midAngle) * midR;
      ctx.fillStyle = isA ? '#00f5ff' : isB ? '#ff006e' : compat ? '#e8e8f0' : '#555566';
      ctx.font = `bold ${seg.mode === 'B' ? 8 : 7}px Orbitron, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seg.label, tx, ty);
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0f';
    ctx.fill();
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (posA) {
      ctx.fillStyle = '#00f5ff';
      ctx.font = 'bold 9px Orbitron, monospace';
      ctx.fillText(deckA.key, CX, CY - 8);
    }
    if (posB) {
      ctx.fillStyle = '#ff006e';
      ctx.font = 'bold 9px Orbitron, monospace';
      ctx.fillText(deckB.key, CX, CY + 8);
    }
    if (!posA && !posB) {
      ctx.fillStyle = '#555566';
      ctx.font = '8px Rajdhani, sans-serif';
      ctx.fillText('KEY', CX, CY);
    }
  }, [posA, posB, hovered, segments]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const dx = mx - CX, dy = my - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < INNER_R || dist > OUTER_R) return;

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;

    const sliceAngle = (Math.PI * 2) / 24;
    const index = Math.floor(angle / sliceAngle) % 24;
    const seg = segments[index];
    if (seg) {
      useDJStore.getState().setLibraryFilter({ key: seg.keyName });
    }
  }, [segments]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const dx = mx - CX, dy = my - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < INNER_R || dist > OUTER_R) {
      setHovered(null);
      return;
    }

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const sliceAngle = (Math.PI * 2) / 24;
    const index = Math.floor(angle / sliceAngle) % 24;
    setHovered(segments[index] ?? null);
  }, [segments]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[8px] font-rajdhani text-muted uppercase tracking-widest mb-1">Camelot Wheel</div>
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE, cursor: 'pointer' }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      />
      {hovered && (
        <div className="text-[9px] font-orbitron text-center" style={{ color: '#e8e8f0' }}>
          {hovered.label} — {hovered.keyName}
        </div>
      )}
    </div>
  );
}
