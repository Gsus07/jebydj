'use client';

import React, { useRef, useCallback } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import type { DAWTrack } from '@/src/store/dawTypes';
import {
  Mic, Volume2, Headphones, Lock, Unlock,
  ChevronDown, ChevronRight, MoreHorizontal,
} from 'lucide-react';

const TRACK_TYPE_ICONS: Record<string, React.ReactNode> = {
  audio:  <Volume2 size={10} />,
  midi:   <Mic size={10} />,
  return: <Headphones size={10} />,
  master: <Volume2 size={10} />,
};

interface TrackHeaderProps {
  track: DAWTrack;
  height: number;
}

export default function TrackHeader({ track, height }: TrackHeaderProps) {
  const store = useDAWStore();
  const nameRef = useRef<HTMLInputElement>(null);

  const toggleMute  = () => store.setTrackMute(track.id, !track.muted);
  const toggleSolo  = () => store.setTrackSolo(track.id, !track.soloed);
  const toggleArmed = () => store.setTrackArmed(track.id, !track.armed);

  const handleNameDblClick = () => nameRef.current?.focus();

  const btnCls = (active: boolean, activeColor: string) =>
    `flex items-center justify-center w-6 h-5 rounded text-[9px] font-bold cursor-pointer select-none transition-colors ${
      active ? '' : 'opacity-40 hover:opacity-70'
    }`;

  return (
    <div
      className="flex flex-col justify-between shrink-0 overflow-hidden"
      style={{
        width: 220,
        height,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-rajdhani)',
      }}
    >
      {/* Top row: color + name + type */}
      <div className="flex items-center gap-1.5 px-1.5 pt-1.5">
        {/* Color swatch */}
        <div
          className="w-2 h-2 rounded-full shrink-0 cursor-pointer"
          style={{ background: track.color }}
          title="Track color"
        />
        {/* Track name */}
        <input
          ref={nameRef}
          defaultValue={track.name}
          onBlur={(e) => store.updateTrack(track.id, { name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') nameRef.current?.blur(); }}
          className="flex-1 bg-transparent outline-none text-sm font-semibold truncate"
          style={{ color: 'var(--text-primary)', caretColor: 'var(--accent-cyan)' }}
          onDoubleClick={handleNameDblClick}
          readOnly={track.locked}
        />
        {/* Type icon */}
        <div style={{ color: track.color, opacity: 0.8 }}>
          {TRACK_TYPE_ICONS[track.type] ?? null}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1 px-1.5 pb-1">
        {/* M/S/R buttons */}
        <button
          className={btnCls(track.muted, 'var(--accent-amber)')}
          style={track.muted ? { background: 'rgba(255,190,11,0.2)', color: 'var(--accent-amber)' } : { color: 'var(--text-muted)' }}
          onClick={toggleMute}
          title="Mute"
        >M</button>
        <button
          className={btnCls(track.soloed, 'var(--accent-cyan)')}
          style={track.soloed ? { background: 'rgba(0,245,255,0.2)', color: 'var(--accent-cyan)' } : { color: 'var(--text-muted)' }}
          onClick={toggleSolo}
          title="Solo"
        >S</button>
        {track.type !== 'master' && (
          <button
            className={btnCls(track.armed, '#ff4444')}
            style={track.armed ? { background: 'rgba(255,68,68,0.2)', color: '#ff4444' } : { color: 'var(--text-muted)' }}
            onClick={toggleArmed}
            title="Arm for recording"
          >R</button>
        )}

        {/* Lock */}
        <button
          className="flex items-center justify-center w-5 h-5 opacity-40 hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => store.updateTrack(track.id, { locked: !track.locked })}
          title={track.locked ? 'Unlock' : 'Lock'}
        >
          {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* VU meter (tiny) */}
        <div className="flex gap-[2px] items-end" style={{ height: 14 }}>
          {[0, 1].map((ch) => (
            <div
              key={ch}
              className="w-1.5 rounded-sm"
              style={{
                height: `${Math.max(4, track.vuLevel * 100)}%`,
                background: track.vuLevel > 0.8 ? '#ff4444' : track.vuLevel > 0.5 ? 'var(--accent-amber)' : 'var(--accent-cyan)',
                transition: 'height 60ms linear',
                maxHeight: 14,
                minHeight: 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Volume + Pan row */}
      {height >= 60 && (
        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          <Volume2 size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={track.volume}
            onChange={(e) => store.setTrackVolume(track.id, parseFloat(e.target.value))}
            className="flex-1 h-1 appearance-none rounded cursor-pointer"
            style={{ accentColor: track.color }}
          />
          <div
            className="text-[9px] w-7 text-right"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-orbitron)' }}
          >
            {Math.round(track.volume * 100)}
          </div>
        </div>
      )}
    </div>
  );
}
