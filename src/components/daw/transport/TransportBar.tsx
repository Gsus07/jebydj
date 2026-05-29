'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import { useDAWEngine } from '@/src/hooks/daw/useDAWEngine';
import { formatPosition, formatTimeCode, beatsToSeconds } from '@/src/lib/daw/TimeSignature';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Circle, Repeat, Music2, Volume2, Cpu,
  ChevronDown,
} from 'lucide-react';

export default function TransportBar() {
  const store = useDAWStore();
  const { play, pause, stop, ensureInit } = useDAWEngine();

  const [showBBT, setShowBBT] = useState(true);
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmInput, setBpmInput] = useState('');
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const bpmRef = useRef<HTMLInputElement>(null);

  const {
    isPlaying, isRecording, positionBeats,
    project, metronomeEnabled, metronomeVolume,
    cpuLoad, undoStack, redoStack,
  } = store;

  const bpm = project.bpm;
  const timeNum = project.timeSignatureNum;
  const timeDen = project.timeSignatureDen;

  const posSeconds = beatsToSeconds(positionBeats, bpm);
  const posDisplay = showBBT
    ? formatPosition(positionBeats, timeNum)
    : formatTimeCode(posSeconds);

  const handlePlayPause = useCallback(() => {
    ensureInit();
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause, ensureInit]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleRecord = useCallback(() => {
    ensureInit();
    store.setRecording(!isRecording);
  }, [isRecording, store, ensureInit]);

  const handleBpmWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    store.setBpm(bpm + delta * (e.shiftKey ? 10 : 1));
  }, [bpm, store]);

  const handleBpmClick = useCallback(() => {
    setEditingBpm(true);
    setBpmInput(bpm.toFixed(2));
    setTimeout(() => bpmRef.current?.select(), 10);
  }, [bpm]);

  const commitBpm = useCallback(() => {
    const v = parseFloat(bpmInput);
    if (!isNaN(v) && v >= 20 && v <= 300) store.setBpm(v);
    setEditingBpm(false);
  }, [bpmInput, store]);

  const handleTapTempo = useCallback(() => {
    ensureInit();
    const now = performance.now();
    setTapTimes((prev) => {
      const filtered = prev.filter((t) => now - t < 3000);
      const taps = [...filtered, now];
      if (taps.length >= 2) {
        let sum = 0;
        for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
        const avgMs = sum / (taps.length - 1);
        store.setBpm(Math.round(60000 / avgMs * 10) / 10);
      }
      return taps.slice(-8);
    });
  }, [ensureInit, store]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'Space' && e.shiftKey) {
        e.preventDefault();
        handleStop();
      } else if (e.code === 'Space' && e.ctrlKey) {
        e.preventDefault();
        handleRecord();
      } else if (e.code === 'KeyL') {
        store.toggleLoop();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
                 (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePlayPause, handleStop, handleRecord, store]);

  const btnBase = 'flex items-center justify-center rounded transition-all duration-150 select-none';
  const transportBtn = `${btnBase} w-8 h-8 hover:bg-white/10 active:scale-95`;

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-1.5 shrink-0 border-b select-none"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        fontFamily: 'var(--font-rajdhani)',
        minHeight: 48,
      }}
    >
      {/* Undo / Redo */}
      <div className="flex gap-1">
        <button
          className={`${transportBtn} text-xs`}
          style={{ opacity: undoStack.length ? 1 : 0.3, color: 'var(--text-muted)' }}
          onClick={() => store.undo()}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          className={`${transportBtn} text-xs`}
          style={{ opacity: redoStack.length ? 1 : 0.3, color: 'var(--text-muted)' }}
          onClick={() => store.redo()}
          title="Redo (Ctrl+Y)"
        >
          ↪
        </button>
      </div>

      <div className="w-px h-6 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <button
          className={transportBtn}
          onClick={handleStop}
          title="Stop (Shift+Space)"
          style={{ color: 'var(--text-primary)' }}
        >
          <Square size={14} />
        </button>
        <button
          className={transportBtn}
          onClick={() => { ensureInit(); dawEngine_seekTo(0); }}
          title="Skip to start"
          style={{ color: 'var(--text-primary)' }}
        >
          <SkipBack size={14} />
        </button>
        <button
          className={`${btnBase} w-10 h-10 rounded-full`}
          onClick={handlePlayPause}
          title="Play/Pause (Space)"
          style={{
            background: isPlaying ? 'var(--accent-cyan)' : 'var(--bg-card)',
            color: isPlaying ? '#000' : 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          className={transportBtn}
          onClick={() => { /* forward */ }}
          title="Skip to end"
          style={{ color: 'var(--text-primary)' }}
        >
          <SkipForward size={14} />
        </button>
        <button
          className={`${transportBtn}`}
          onClick={handleRecord}
          title="Record (Ctrl+Space)"
          style={{ color: isRecording ? '#ff4444' : 'var(--text-muted)' }}
        >
          <Circle size={14} fill={isRecording ? '#ff4444' : 'none'} />
        </button>
      </div>

      <div className="w-px h-6 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Position Display */}
      <button
        className="min-w-[120px] text-center cursor-pointer px-2 py-1 rounded font-mono text-sm tracking-wider hover:bg-white/5"
        style={{
          fontFamily: 'var(--font-orbitron)',
          color: 'var(--accent-cyan)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
        onClick={() => setShowBBT((v) => !v)}
        title="Click to toggle BBT/MMSS"
      >
        {posDisplay}
      </button>

      <div className="w-px h-6 shrink-0" style={{ background: 'var(--border)' }} />

      {/* BPM */}
      <div className="flex flex-col items-center">
        <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>BPM</div>
        {editingBpm ? (
          <input
            ref={bpmRef}
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={(e) => { if (e.key === 'Enter') commitBpm(); if (e.key === 'Escape') setEditingBpm(false); }}
            className="w-16 text-center text-sm rounded px-1 outline-none"
            style={{ background: 'var(--bg-card)', color: 'var(--accent-amber)', border: '1px solid var(--accent-amber)', fontFamily: 'var(--font-orbitron)' }}
          />
        ) : (
          <div
            className="w-16 text-center text-sm cursor-pointer rounded px-1 hover:bg-white/5"
            style={{ fontFamily: 'var(--font-orbitron)', color: 'var(--accent-amber)' }}
            onClick={handleBpmClick}
            onWheel={handleBpmWheel}
            title="Scroll to adjust, click to type"
          >
            {bpm.toFixed(1)}
          </div>
        )}
      </div>

      {/* Tap Tempo */}
      <button
        className={`${btnBase} px-2 h-6 text-[10px] tracking-widest rounded hover:bg-white/10`}
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        onClick={handleTapTempo}
        title="Tap Tempo"
      >
        TAP
      </button>

      {/* Time Signature */}
      <div className="flex items-center gap-1">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>TIME</div>
        <select
          value={timeNum}
          onChange={(e) => store.setTimeSignature(parseInt(e.target.value), timeDen)}
          className="text-sm rounded px-1 outline-none cursor-pointer"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', height: 24 }}
        >
          {[2,3,4,5,6,7,8,9,12].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <select
          value={timeDen}
          onChange={(e) => store.setTimeSignature(timeNum, parseInt(e.target.value))}
          className="text-sm rounded px-1 outline-none cursor-pointer"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', height: 24 }}
        >
          {[2,4,8,16].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="w-px h-6 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Loop */}
      <button
        className={`${btnBase} px-2 h-6 gap-1 text-xs`}
        style={{
          color: project.loopEnabled ? 'var(--accent-cyan)' : 'var(--text-muted)',
          background: project.loopEnabled ? 'rgba(0,245,255,0.1)' : 'transparent',
          border: `1px solid ${project.loopEnabled ? 'var(--accent-cyan)' : 'var(--border)'}`,
          borderRadius: 4,
        }}
        onClick={() => store.toggleLoop()}
        title="Toggle Loop (L)"
      >
        <Repeat size={12} />
        LOOP
      </button>

      <div className="w-px h-6 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Swing */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>SWING</div>
        <input
          type="range"
          min={0}
          max={100}
          value={project.swing}
          onChange={(e) => store.setSwing(parseInt(e.target.value))}
          className="w-16 h-1 appearance-none rounded cursor-pointer"
          style={{ accentColor: 'var(--accent-magenta)' }}
          title={`Swing: ${project.swing}%`}
        />
      </div>

      <div className="w-px h-6 shrink-0" style={{ background: 'var(--border)' }} />

      {/* Metronome */}
      <div className="flex items-center gap-1">
        <button
          className={`${btnBase} px-2 h-6 gap-1 text-xs`}
          style={{
            color: metronomeEnabled ? 'var(--accent-amber)' : 'var(--text-muted)',
            background: metronomeEnabled ? 'rgba(255,190,11,0.1)' : 'transparent',
            border: `1px solid ${metronomeEnabled ? 'var(--accent-amber)' : 'var(--border)'}`,
            borderRadius: 4,
          }}
          onClick={() => store.setMetronome(!metronomeEnabled)}
          title="Metronome"
        >
          <Music2 size={12} />
          CLICK
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={metronomeVolume}
          onChange={(e) => store.setMetronomeVolume(parseFloat(e.target.value))}
          className="w-12 h-1 appearance-none rounded cursor-pointer"
          style={{ accentColor: 'var(--accent-amber)', opacity: metronomeEnabled ? 1 : 0.4 }}
          title={`Metronome volume: ${Math.round(metronomeVolume * 100)}%`}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* CPU Meter */}
      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Cpu size={10} />
        <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${cpuLoad}%`,
              background: cpuLoad > 80 ? '#ff4444' : cpuLoad > 60 ? 'var(--accent-amber)' : 'var(--accent-cyan)',
            }}
          />
        </div>
        <span style={{ fontFamily: 'var(--font-orbitron)', fontSize: 9 }}>{Math.round(cpuLoad)}%</span>
      </div>
    </div>
  );
}

// Import for seekTo in transport
import { dawEngine as _dawEngine } from '@/src/lib/daw/DAWEngine';
function dawEngine_seekTo(beats: number) { _dawEngine.seekTo(beats); }
