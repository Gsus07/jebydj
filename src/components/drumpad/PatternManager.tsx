'use client';

import React from 'react';
import { useSampleStore } from '@/src/store/useSampleStore';

const SLOT_NAMES = ['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4'];

export function PatternManager() {
  const store = useSampleStore();
  const { dm } = store;
  const patterns = dm.patterns;
  const currentId = dm.currentPatternId;

  const add = () => {
    if (patterns.length >= 16) return;
    const id = store.addPattern();
    store.setCurrentPattern(id);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap px-1">
      {SLOT_NAMES.slice(0, Math.max(patterns.length + 1, 4)).map((slot, i) => {
        const pattern = patterns[i];
        if (!pattern) {
          return (
            <button
              key={slot}
              className="w-7 h-7 rounded text-[9px] border border-dashed"
              style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.15)' }}
              onClick={add}
              title="Add pattern"
            >+</button>
          );
        }
        const isActive = pattern.id === currentId;
        return (
          <button
            key={pattern.id}
            className="w-7 h-7 rounded text-[9px] font-bold transition-all"
            style={{
              background: isActive ? 'var(--accent-cyan)' : 'var(--bg-surface)',
              color: isActive ? '#000' : 'var(--text-muted)',
              border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border)'}`,
              fontFamily: 'var(--font-orbitron)',
            }}
            onClick={() => store.setCurrentPattern(pattern.id)}
            onDoubleClick={() => {
              const name = prompt('Rename pattern:', pattern.name);
              if (name) store.renamePattern(pattern.id, name);
            }}
            title={pattern.name}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}
