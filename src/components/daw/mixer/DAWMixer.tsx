'use client';

import React from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import { X, Volume2 } from 'lucide-react';

export default function DAWMixer() {
  const store = useDAWStore();
  const { project } = store;

  const tracks = project.tracks;

  return (
    <div
      className="flex flex-col border-t"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        height: 220,
        fontFamily: 'var(--font-rajdhani)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 h-7 shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-cyan)' }}>
          Mixer
        </span>
        <button
          onClick={() => store.setMixerOpen(false)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={10} />
        </button>
      </div>

      {/* Channel strips */}
      <div className="flex gap-px overflow-x-auto flex-1 p-1">
        {tracks.map((track) => (
          <ChannelStrip key={track.id} trackId={track.id} />
        ))}
        {/* Master */}
        <MasterStrip />
      </div>
    </div>
  );
}

function ChannelStrip({ trackId }: { trackId: string }) {
  const store = useDAWStore();
  const track = store.project.tracks.find((t) => t.id === trackId);
  if (!track) return null;

  const faderH = 100;
  const vuH = faderH;
  const vuFill = Math.max(0, Math.min(1, track.vuLevel));

  return (
    <div
      className="flex flex-col items-center gap-1 px-1 py-1 rounded shrink-0"
      style={{
        width: 52,
        background: 'var(--bg-card)',
        border: `1px solid var(--border)`,
        borderTop: `2px solid ${track.color}`,
      }}
    >
      {/* Name */}
      <div className="text-[8px] font-semibold truncate max-w-full text-center" style={{ color: 'var(--text-primary)' }}>
        {track.name}
      </div>

      {/* Pan */}
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={track.pan}
        onChange={(e) => store.setTrackPan(trackId, parseFloat(e.target.value))}
        className="w-full h-0.5 appearance-none rounded cursor-pointer"
        style={{ accentColor: track.color }}
        title={`Pan: ${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(Math.round(track.pan * 100))}`}
      />

      {/* Fader + VU */}
      <div className="flex items-end gap-0.5" style={{ height: faderH }}>
        {/* VU */}
        <div className="flex flex-col-reverse gap-px" style={{ height: vuH }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const segmentVal = (i + 1) / 10;
            const active = vuFill >= segmentVal - 0.05;
            const color = i >= 8 ? '#ff4444' : i >= 6 ? 'var(--accent-amber)' : 'var(--accent-cyan)';
            return (
              <div
                key={i}
                style={{
                  width: 4,
                  height: vuH / 12,
                  borderRadius: 1,
                  background: active ? color : 'var(--bg-surface)',
                  opacity: active ? 1 : 0.2,
                  transition: 'background 60ms',
                }}
              />
            );
          })}
        </div>

        {/* Fader */}
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={track.volume}
          onChange={(e) => store.setTrackVolume(trackId, parseFloat(e.target.value))}
          className="appearance-none cursor-pointer"
          style={{
            accentColor: track.color,
            writingMode: 'vertical-lr' as const,
            height: faderH,
            width: 16,
            direction: 'rtl',
          }}
          title={`Volume: ${Math.round(track.volume * 100)}%`}
        />
      </div>

      {/* M/S buttons */}
      <div className="flex gap-0.5">
        <button
          className="text-[7px] font-bold px-1 rounded"
          style={{
            background: track.muted ? 'rgba(255,190,11,0.2)' : 'var(--bg-surface)',
            color: track.muted ? 'var(--accent-amber)' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
          onClick={() => store.setTrackMute(trackId, !track.muted)}
        >M</button>
        <button
          className="text-[7px] font-bold px-1 rounded"
          style={{
            background: track.soloed ? 'rgba(0,245,255,0.2)' : 'var(--bg-surface)',
            color: track.soloed ? 'var(--accent-cyan)' : 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
          onClick={() => store.setTrackSolo(trackId, !track.soloed)}
        >S</button>
      </div>

      {/* dB value */}
      <div className="text-[7px] font-mono" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-orbitron)' }}>
        {track.volume === 1 ? '0.0' : (20 * Math.log10(track.volume + 0.001)).toFixed(1)}
      </div>
    </div>
  );
}

function MasterStrip() {
  return (
    <div
      className="flex flex-col items-center gap-1 px-1 py-1 rounded shrink-0 ml-2"
      style={{
        width: 60,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: '2px solid var(--accent-cyan)',
      }}
    >
      <Volume2 size={10} style={{ color: 'var(--accent-cyan)' }} />
      <div className="text-[8px] font-bold uppercase" style={{ color: 'var(--accent-cyan)' }}>Master</div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>—</div>
      </div>
    </div>
  );
}
