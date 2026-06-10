'use client';

import React, { useState, useCallback } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { ChannelRow } from './ChannelRow';
import { PatternSelector } from './PatternSelector';
import { KeyboardPiano } from '../utility/KeyboardPiano';
import { patternEngine } from '@/src/lib/pattern/PatternEngine';
import { SYNTH_LABELS } from '@/src/lib/synths/SynthInterface';
import type { SynthType } from '@/src/lib/synths/SynthInterface';
import { generateAllSounds } from '@/src/lib/samples/ProceduralSounds';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import {
  Plus, Play, Square, X, ChevronDown,
} from 'lucide-react';

// ─── Add Channel Menu ────────────────────────────────────────────────────────

const SAMPLE_PRESETS = [
  { name: 'Kick', category: 'kicks' },
  { name: 'Snare', category: 'snares' },
  { name: 'Hi-Hat', category: 'hihat' },
  { name: 'Clap', category: 'percussion' },
  { name: 'Perc', category: 'percussion' },
  { name: 'Custom sample...', category: 'user' },
] as const;

const SYNTH_OPTIONS: { type: SynthType; label: string }[] = [
  { type: 'threeOsc', label: '3xOsc' },
  { type: 'fmSynth', label: 'FM Synth' },
  { type: 'sytrus', label: 'Sytrus' },
  { type: 'booBass', label: 'BooBass' },
  { type: 'plucked', label: 'Plucked String' },
  { type: 'flex', label: 'FLEX Rompler' },
];

// ─── ChannelRack ─────────────────────────────────────────────────────────────

export function ChannelRack() {
  const {
    channels, playing, channelRackOpen,
    addChannel, setChannelRackOpen, stepCount, setGlobalStepCount,
  } = useChannelRackStore();

  const [showAddMenu, setShowAddMenu] = useState(false);

  const regenerateSamples = useCallback(async () => {
    if (audioEngine.ctx && audioEngine.ctx.state !== 'running') {
      try { await audioEngine.ctx.resume(); } catch (_) {}
    }

    console.log('Generando samples procedurales...');
    const sounds = await generateAllSounds(audioEngine.ctx);
    console.log('Samples generados:', sounds.length);

    const { sampleManager } = await import('@/src/lib/samples/SampleManager');
    
    for (const s of sounds) {
      sampleManager.storeBuffer(s.id, s.buffer);
      // Fallback for default channels that use 'kick_808' instead of 'proc_kick_808'
      sampleManager.storeBuffer(s.id.replace('proc_', ''), s.buffer); 
    }

    console.log('Buffers asignados a SampleManager');
  }, []);

  React.useEffect(() => {
    const init = async () => {
      if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') {
        try { await audioEngine.ctx.resume(); } catch(_) {}
      }
      await regenerateSamples();
    };
    init();
  }, [regenerateSamples]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__channelRack = {
        get channels() { return useChannelRackStore.getState().channels },
        get patterns() { return useChannelRackStore.getState().patterns },
        scheduler: patternEngine
      };
    }
  }, []);

  const handleAddSample = useCallback((name: string) => {
    addChannel(name, 'sample');
    setShowAddMenu(false);
  }, [addChannel]);

  const handleAddSynth = useCallback((type: SynthType) => {
    addChannel(SYNTH_LABELS[type], 'instrument', { instrumentType: type });
    setShowAddMenu(false);
  }, [addChannel]);

  if (!channelRackOpen) return null;

  return (
    <div
      className="flex flex-col border-t"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border)',
        fontFamily: 'var(--font-rajdhani)',
      }}
    >
      {/* Header */}
      <div
        className="daw-hscroll flex items-center gap-2 px-3 min-h-8 shrink-0 border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: 'var(--accent-magenta)' }}
        >
          Channel Rack
        </span>

        <div className="w-px h-4" style={{ background: 'var(--border)' }} />

        {/* Pattern selector */}
        <PatternSelector />

        <div className="flex-1" />

        {/* Step count */}
        <select
          value={stepCount}
          onChange={(e) => setGlobalStepCount(Number(e.target.value) as 16 | 32 | 64)}
          className="text-[10px] rounded px-1 h-5 outline-none cursor-pointer font-rajdhani"
          style={{
            background: 'var(--bg-card)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          <option value={16}>16 steps</option>
          <option value={32}>32 steps</option>
          <option value={64}>64 steps</option>
        </select>

        {/* Play / Stop */}
        <button
          onClick={async () => {
            if (playing) {
              patternEngine.toggle();
              return;
            }

            try {
              if (audioEngine.ctx.state !== 'running') {
                await audioEngine.ctx.resume();
              }
            } catch (err) {
              console.error('No se pudo iniciar el AudioContext:', err);
              return;
            }

            console.log('AudioContext state al presionar Play:', audioEngine.ctx.state);

            const { sampleManager } = await import('@/src/lib/samples/SampleManager');
            const channels = useChannelRackStore.getState().channels;
            console.log('Canales:', channels.map(c => ({
              name: c.name,
              hasBuffer: !!(c.sampleId && sampleManager.getBuffer(c.sampleId))
            })));

            const hasAnyBuffer = channels.some(c => c.sampleId && sampleManager.getBuffer(c.sampleId));
            if (!hasAnyBuffer) {
              console.error('Ningún canal tiene AudioBuffer — regenerando samples...');
              await regenerateSamples();
            }

            patternEngine.toggle();
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10"
          style={{ color: playing ? '#ff4444' : 'var(--accent-cyan)' }}
          title={playing ? 'Stop' : 'Play pattern'}
        >
          {playing ? <Square size={12} /> : <Play size={12} />}
        </button>

        {/* Close */}
        <button
          onClick={() => setChannelRackOpen(false)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Channel rows */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '35vh' }}>
        {channels.map((ch) => (
          <ChannelRow key={ch.id} channel={ch} />
        ))}

        {/* Add channel button */}
        <div className="relative px-2 py-2">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-rajdhani font-semibold transition-all hover:bg-white/5 w-full justify-center"
            style={{
              color: 'var(--text-muted)',
              border: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            <Plus size={12} />
            ADD CHANNEL
            <ChevronDown size={10} />
          </button>

          {/* Add dropdown */}
          {showAddMenu && (
            <div
              className="absolute bottom-full left-2 right-2 mb-1 z-50 rounded-lg py-1 max-h-[300px] overflow-y-auto"
              style={{
                background: 'rgba(18,18,30,0.98)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 -8px 30px rgba(0,0,0,0.6)',
              }}
            >
              {/* Samples */}
              <div className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--accent-cyan)' }}>
                Muestras
              </div>
              {SAMPLE_PRESETS.map((s) => (
                <button
                  key={s.name}
                  className="w-full text-left px-3 py-1 text-xs hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={() => handleAddSample(s.name)}
                >
                  {s.name}
                </button>
              ))}

              <div className="h-px mx-2 my-1" style={{ background: 'var(--border)' }} />

              {/* Synths */}
              <div className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--accent-magenta)' }}>
                Sintetizadores
              </div>
              {SYNTH_OPTIONS.map((s) => (
                <button
                  key={s.type}
                  className="w-full text-left px-3 py-1 text-xs hover:bg-white/5"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={() => handleAddSynth(s.type)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Keyboard Piano (MIDI Testing) */}
        <div className="px-2 pb-2">
           <div className="text-[9px] uppercase tracking-wider font-bold text-white/50 mb-1 ml-1">Keyboard Input</div>
           <KeyboardPiano />
        </div>
      </div>
      
      {process.env.NODE_ENV === 'development' && (
        <button
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            padding: '8px 16px',
            background: '#00f5ff',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700
          }}
          onClick={async () => {
            await audioEngine.ctx.resume()

            console.log('=== AUDIO TEST ===')
            console.log('ctx.state:', audioEngine.ctx.state)
            console.log('ctx.sampleRate:', audioEngine.ctx.sampleRate)
            console.log('masterGain.gain:', audioEngine.masterGain.gain.value)

            const osc = audioEngine.ctx.createOscillator()
            const gain = audioEngine.ctx.createGain()
            osc.frequency.value = 440  // La4
            gain.gain.setValueAtTime(0.3, audioEngine.ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, audioEngine.ctx.currentTime + 0.5)
            osc.connect(gain)
            gain.connect(audioEngine.masterGain)
            osc.start()
            osc.stop(audioEngine.ctx.currentTime + 0.5)

            console.log('Si escuchas un beep de 440Hz, el audio funciona')
          }}
        >
          🔊 TEST AUDIO
        </button>
      )}
    </div>
  );
}

export default ChannelRack;
