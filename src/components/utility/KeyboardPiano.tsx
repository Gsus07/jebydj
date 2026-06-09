'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { getSynth } from '@/src/lib/pattern/PatternEngine';

// QWERTY keyboard to MIDI mapping
// zxcv... = C4, D4...
// asdf... = C#4, D#4...
// qwer... = C5, D5...
// 1234... = C#5, D#5...
const KEY_MAP: Record<string, number> = {
  'z': 60, 's': 61, 'x': 62, 'd': 63, 'c': 64, 'v': 65, 'g': 66, 'b': 67, 'h': 68, 'n': 69, 'j': 70, 'm': 71, ',': 72,
  'q': 72, '2': 73, 'w': 74, '3': 75, 'e': 76, 'r': 77, '5': 78, 't': 79, '6': 80, 'y': 81, '7': 82, 'u': 83, 'i': 84
};

export function KeyboardPiano() {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const activeChannelId = useChannelRackStore(s => s.activeChannelId);

  // We keep track of which keys are held down so we don't re-trigger noteOn on OS key repeat
  const heldKeys = useRef<Set<string>>(new Set());

  const getActiveSynth = useCallback(() => {
    if (!activeChannelId) return null;
    return getSynth(activeChannelId);
  }, [activeChannelId]);

  const playNote = useCallback((note: number) => {
    const synth = getActiveSynth();
    if (synth) synth.noteOn(note, 100, 0); // velocity 100
    
    // Dispatch score log event
    window.dispatchEvent(new CustomEvent('midi-log', {
      detail: { id: `log_${Date.now()}_${Math.random()}`, timestamp: Date.now(), pitch: note, velocity: 100 }
    }));
    
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });
  }, [getActiveSynth]);

  const releaseNote = useCallback((note: number) => {
    const synth = getActiveSynth();
    if (synth) synth.noteOff(note, 0);
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, [getActiveSynth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      if (KEY_MAP[key] !== undefined && !heldKeys.current.has(key)) {
        heldKeys.current.add(key);
        playNote(KEY_MAP[key]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEY_MAP[key] !== undefined) {
        heldKeys.current.delete(key);
        releaseNote(KEY_MAP[key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [playNote, releaseNote]);

  // Generate piano keys for visual feedback (2 octaves: C4 to C6)
  const keys = [];
  const startMidi = 60; // C4
  for (let i = 0; i <= 24; i++) {
    const midi = startMidi + i;
    const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
    keys.push({ midi, isBlack });
  }

  return (
    <div className="flex bg-black/50 p-2 rounded border border-white/10 items-start h-24">
      {keys.map(({ midi, isBlack }) => {
        const isActive = activeNotes.has(midi);
        if (isBlack) {
          return (
            <div 
              key={midi} 
              className="w-4 h-14 -mx-2 z-10 rounded-b cursor-pointer transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--accent-cyan)' : '#222',
                border: '1px solid #000'
              }}
              onMouseDown={() => playNote(midi)}
              onMouseUp={() => releaseNote(midi)}
              onMouseLeave={() => { if(isActive) releaseNote(midi) }}
            />
          );
        } else {
          return (
            <div 
              key={midi} 
              className="w-8 h-full bg-white rounded-b cursor-pointer transition-colors border border-black/20"
              style={{
                backgroundColor: isActive ? 'var(--accent-magenta)' : '#eee',
              }}
              onMouseDown={() => playNote(midi)}
              onMouseUp={() => releaseNote(midi)}
              onMouseLeave={() => { if(isActive) releaseNote(midi) }}
            />
          );
        }
      })}
    </div>
  );
}
