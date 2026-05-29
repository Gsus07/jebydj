'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Drum, Music2, Layers, Volume2, VolumeX } from 'lucide-react';
import type { DeckId, StemType } from '@/src/store/types';
import { useDJStore } from '@/src/store/useDJStore';
import { stemSeparator, type StemBuffers } from '@/src/lib/audio/StemSeparator';
import { getDeckPlayer } from '@/src/lib/audio/DeckPlayer';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import { generateWaveform } from '@/src/lib/audio/WaveformAnalyzer';

const STEM_ICONS: Record<StemType, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  vocals: Mic,
  drums: Drum,
  bass: Layers,
  other: Music2,
};

const STEM_COLORS: Record<StemType, string> = {
  vocals: '#00f5ff',
  drums: '#ff006e',
  bass: '#ffbe0b',
  other: '#8338ec',
};

// Per-deck stem gain nodes (created once and inserted into the audio graph)
const stemGainNodes = new Map<string, GainNode>();

function getStemGainKey(deckId: DeckId, type: StemType) {
  return `${deckId}:${type}`;
}

interface MiniWaveformProps {
  data: Float32Array | null;
  color: string;
  width?: number;
  height?: number;
}

function MiniWaveform({ data, color, width = 200, height = 40 }: MiniWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const step = Math.floor(data.length / width);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const i = x * step;
      const v = Math.abs(data[i] || 0);
      const h = v * height;
      const y = (height - h) / 2;
      if (x === 0) ctx.moveTo(x, height / 2);
      ctx.lineTo(x, y);
      ctx.lineTo(x, height - y);
      ctx.lineTo(x, height / 2);
    }
    ctx.stroke();
  }, [data, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  );
}

interface DeckStemsProps {
  deckId: DeckId;
  trackId: string;
  audioBuffer: AudioBuffer | null;
}

export function DeckStems({ deckId, trackId, audioBuffer }: DeckStemsProps) {
  const stemState = useDJStore((s) => s.stems[deckId]);
  const { setStemState, setStemChannel } = useDJStore.getState();
  const accentColor = deckId === 'A' ? '#00f5ff' : '#ff006e';

  const stemBuffersRef = useRef<StemBuffers | null>(null);
  const sourceNodesRef = useRef<Map<StemType, AudioBufferSourceNode>>(new Map());

  const handleSeparate = useCallback(async () => {
    if (!audioBuffer || stemState.processing) return;

    setStemState(deckId, { processing: true, progress: 0, ready: false });

    try {
      const result = await stemSeparator.separate(
        audioBuffer,
        trackId,
        (percent, stage) => {
          setStemState(deckId, { progress: percent });
        }
      );

      stemBuffersRef.current = result.stems;

      // Generate mini waveforms for each stem
      const stemTypes: StemType[] = ['vocals', 'drums', 'bass', 'other'];
      for (const type of stemTypes) {
        const stemBuf = result.stems[type];
        const { waveformData } = generateWaveform(stemBuf, 400);
        setStemChannel(deckId, type, { waveformData });
      }

      setStemState(deckId, {
        processing: false,
        ready: true,
        progress: 100,
        memoryBytes: result.memoryBytes,
        expanded: true,
      });
    } catch (err) {
      console.error('Stem separation failed:', err);
      setStemState(deckId, { processing: false, progress: 0 });
    }
  }, [audioBuffer, trackId, deckId, stemState.processing, setStemState, setStemChannel]);

  const handleVolumeChange = useCallback((type: StemType, volume: number) => {
    setStemChannel(deckId, type, { volume });
    const key = getStemGainKey(deckId, type);
    const gainNode = stemGainNodes.get(key);
    if (gainNode && audioEngine.ctx) {
      gainNode.gain.linearRampToValueAtTime(volume, audioEngine.ctx.currentTime + 0.01);
    }
  }, [deckId, setStemChannel]);

  const handleMute = useCallback((type: StemType) => {
    const current = stemState.channels[type];
    const newMuted = !current.muted;
    setStemChannel(deckId, type, { muted: newMuted });
    const key = getStemGainKey(deckId, type);
    const gainNode = stemGainNodes.get(key);
    if (gainNode && audioEngine.ctx) {
      gainNode.gain.linearRampToValueAtTime(
        newMuted ? 0 : current.volume,
        audioEngine.ctx.currentTime + 0.01
      );
    }
  }, [deckId, stemState.channels, setStemChannel]);

  const handleSolo = useCallback((type: StemType) => {
    const stemTypes: StemType[] = ['vocals', 'drums', 'bass', 'other'];
    const current = stemState.channels[type];
    const newSolo = !current.solo;

    stemTypes.forEach((t) => {
      const isSoloed = t === type ? newSolo : false;
      const isMuted = newSolo && t !== type;
      setStemChannel(deckId, t, { solo: isSoloed, muted: isMuted });

      const key = getStemGainKey(deckId, t);
      const gainNode = stemGainNodes.get(key);
      if (gainNode && audioEngine.ctx) {
        const targetVol = isMuted ? 0 : stemState.channels[t].volume;
        gainNode.gain.linearRampToValueAtTime(targetVol, audioEngine.ctx.currentTime + 0.01);
      }
    });
  }, [deckId, stemState.channels, setStemChannel]);

  const handleRelease = useCallback(() => {
    stemSeparator.releaseTrack(trackId);
    setStemState(deckId, { ready: false, progress: 0, memoryBytes: 0 });
    stemBuffersRef.current = null;
  }, [trackId, deckId, setStemState]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const stemTypes: StemType[] = ['vocals', 'drums', 'bass', 'other'];

  return (
    <div className="border-t border-[#2a2a3a] mt-1">
      {/* Header row */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStemState(deckId, { expanded: !stemState.expanded })}
            className="text-[9px] font-orbitron font-bold px-2 py-1 rounded border transition-all"
            style={{
              borderColor: stemState.ready ? accentColor : '#2a2a3a',
              color: stemState.ready ? accentColor : '#555566',
              backgroundColor: stemState.ready ? `${accentColor}11` : 'transparent',
            }}
          >
            STEMS {stemState.ready ? '▾' : '▸'}
          </button>

          {stemState.ready && (
            <span className="text-[8px] font-orbitron px-1 rounded" style={{ backgroundColor: '#00cc4422', color: '#00cc44', border: '1px solid #00cc4444' }}>
              READY
            </span>
          )}
          {stemState.ready && (
            <span className="text-[8px] font-rajdhani text-muted">{formatBytes(stemState.memoryBytes)}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!stemState.ready && !stemState.processing && audioBuffer && (
            <button
              onClick={handleSeparate}
              className="text-[9px] font-orbitron px-2 py-0.5 rounded border border-[#8338ec44] text-[#8338ec] hover:bg-[#8338ec22]"
            >
              SEPARATE
            </button>
          )}
          {stemState.ready && (
            <button
              onClick={handleRelease}
              className="text-[9px] font-orbitron px-2 py-0.5 rounded border border-[#2a2a3a] text-muted hover:text-red-400"
            >
              FREE MEM
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {stemState.processing && (
        <div className="px-2 pb-1">
          <div className="h-1.5 rounded bg-[#1a1a24] overflow-hidden">
            <motion.div
              className="h-full rounded"
              style={{ backgroundColor: '#8338ec' }}
              animate={{ width: `${stemState.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-[8px] font-orbitron text-muted">{stemState.progress}% separating stems...</span>
        </div>
      )}

      {/* Stem channels */}
      <AnimatePresence>
        {stemState.expanded && stemState.ready && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1">
              {stemTypes.map((type) => {
                const ch = stemState.channels[type];
                const Icon = STEM_ICONS[type];
                const color = STEM_COLORS[type];
                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 p-1.5 rounded"
                    style={{
                      backgroundColor: ch.muted ? '#0a0a0f' : '#1a1a24',
                      border: `1px solid ${ch.solo ? color : '#2a2a3a'}`,
                      opacity: ch.muted ? 0.5 : 1,
                    }}
                  >
                    {/* Icon + label */}
                    <Icon size={11} style={{ color, flexShrink: 0 }} />
                    <span className="text-[9px] font-orbitron w-12 flex-shrink-0 uppercase" style={{ color }}>
                      {type}
                    </span>

                    {/* Mini waveform */}
                    <div className="flex-1 min-w-0 overflow-hidden" style={{ height: 28 }}>
                      <MiniWaveform
                        data={ch.waveformData}
                        color={ch.muted ? '#333344' : color}
                        width={120}
                        height={28}
                      />
                    </div>

                    {/* Volume fader */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(ch.volume * 100)}
                      onChange={(e) => handleVolumeChange(type, Number(e.target.value) / 100)}
                      className="w-16 h-1 cursor-pointer flex-shrink-0"
                      style={{ accentColor: color }}
                    />

                    {/* SOLO button */}
                    <button
                      onClick={() => handleSolo(type)}
                      className="text-[7px] font-orbitron px-1.5 py-0.5 rounded flex-shrink-0 transition-all"
                      style={{
                        border: `1px solid ${ch.solo ? color : '#2a2a3a'}`,
                        color: ch.solo ? color : '#555566',
                        backgroundColor: ch.solo ? `${color}22` : 'transparent',
                      }}
                    >
                      S
                    </button>

                    {/* MUTE button */}
                    <button
                      onClick={() => handleMute(type)}
                      className="text-[8px] flex-shrink-0 transition-all"
                      style={{ color: ch.muted ? '#ff006e' : '#555566' }}
                    >
                      {ch.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                    </button>

                    {/* LED */}
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: ch.muted ? '#333344' : color,
                        boxShadow: ch.muted ? 'none' : `0 0 4px ${color}`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
