'use client';

import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDJStore } from '@/src/store/useDJStore';
import { audioEngine } from '@/src/lib/audio/AudioEngine';

// Simple audio buffer cache for sampler pads
const samplerBuffers: Map<string, AudioBuffer> = new Map();
const samplerSources: Map<number, AudioBufferSourceNode> = new Map();

function triggerPad(padId: number, trackId: string | null, volume: number, pitch: number): void {
  if (!trackId || !audioEngine.isInitialized()) return;
  const buffer = samplerBuffers.get(trackId);
  if (!buffer) return;

  // Stop existing if toggle or gate mode handled
  const existing = samplerSources.get(padId);
  if (existing) {
    try { existing.stop(); } catch { /* ignore */ }
    samplerSources.delete(padId);
  }

  const ctx = audioEngine.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = Math.pow(2, pitch / 12);

  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;

  src.connect(gainNode);
  gainNode.connect(audioEngine.masterGain);
  src.start();
  samplerSources.set(padId, src);

  src.onended = () => {
    samplerSources.delete(padId);
    useDJStore.getState().setSamplerPad(padId, { isPlaying: false });
  };

  useDJStore.getState().setSamplerPad(padId, { isPlaying: true });
}

interface SamplerPadComponentProps {
  padIndex: number;
}

function SamplerPadComp({ padIndex }: SamplerPadComponentProps) {
  const pad = useDJStore((s) => s.sampler.pads[padIndex]);
  const { setSamplerPad } = useDJStore.getState();

  const handleClick = useCallback(() => {
    if (!pad.trackId) return;
    triggerPad(padIndex, pad.trackId, pad.volume, pad.pitch);
  }, [pad, padIndex]);

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={handleClick}
      className="relative flex flex-col items-center justify-center rounded-lg overflow-hidden aspect-square"
      style={{
        backgroundColor: pad.trackId ? `${pad.color}22` : '#111118',
        border: `1.5px solid ${pad.trackId ? (pad.isPlaying ? pad.color : `${pad.color}66`) : '#2a2a3a'}`,
        boxShadow: pad.isPlaying ? `0 0 12px ${pad.color}88` : 'none',
        cursor: pad.trackId ? 'pointer' : 'default',
        minHeight: 44,
      }}
    >
      {/* Active glow */}
      {pad.isPlaying && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ backgroundColor: `${pad.color}33` }}
        />
      )}

      <span
        className="text-[10px] font-orbitron font-bold z-10"
        style={{ color: pad.trackId ? pad.color : '#333344' }}
      >
        {padIndex + 1}
      </span>

      {pad.trackName && (
        <span
          className="text-[7px] font-rajdhani text-center px-1 z-10 leading-tight"
          style={{ color: `${pad.color}99`, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {pad.trackName}
        </span>
      )}

      {!pad.trackId && (
        <span className="text-[8px] font-rajdhani text-muted opacity-50">EMPTY</span>
      )}

      {/* LED indicator */}
      {pad.isPlaying && (
        <div
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: pad.color, boxShadow: `0 0 6px ${pad.color}` }}
        />
      )}
    </motion.button>
  );
}

export function Sampler() {
  const bank = useDJStore((s) => s.sampler.bank);
  const { setSamplerBank } = useDJStore.getState();

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3a' }}>
      {/* Header with bank selector */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-rajdhani text-muted uppercase tracking-widest">SAMPLER</span>
        <div className="flex gap-1">
          {(['A', 'B', 'C', 'D'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setSamplerBank(b)}
              className="text-[9px] font-orbitron w-6 h-6 rounded border"
              style={{
                borderColor: bank === b ? '#00f5ff' : '#2a2a3a',
                color: bank === b ? '#00f5ff' : '#555566',
                backgroundColor: bank === b ? '#00f5ff22' : 'transparent',
              }}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* 4x4 pad grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 16 }, (_, i) => (
          <SamplerPadComp key={i} padIndex={i} />
        ))}
      </div>
    </div>
  );
}

// Export buffer cache for loading
export { samplerBuffers };
