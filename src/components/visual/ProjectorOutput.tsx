'use client';

import { useState, useCallback } from 'react';
import { useVisualStore } from '../../store/useVisualStore';

export function ProjectorOutput() {
  const [open, setOpen] = useState(false);
  const { setMode } = useVisualStore();

  const openProjector = useCallback(() => {
    const w = window.open(
      '/visual-output',
      'visual-output',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no',
    );
    if (w) {
      setOpen(true);
      setMode('projector');
      w.addEventListener('beforeunload', () => { setOpen(false); setMode('embedded'); });
    }
  }, [setMode]);

  return (
    <button
      onClick={openProjector}
      className={[
        'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-all',
        open
          ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50'
          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
      ].join(' ')}
      title="Open projector window"
    >
      <span>⎚</span>
      <span>{open ? 'PROJECTING' : 'PROJECTOR'}</span>
    </button>
  );
}
