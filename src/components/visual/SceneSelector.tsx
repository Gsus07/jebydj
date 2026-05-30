'use client';

import { useVisualStore } from '../../store/useVisualStore';
import type { SceneName } from '../../store/useVisualStore';

const SCENES: { id: SceneName; label: string; icon: string }[] = [
  { id: 'particle',  label: 'Particles',   icon: '✦' },
  { id: 'geometry',  label: 'Geometry',    icon: '⬡' },
  { id: 'waveform',  label: 'Waveform',    icon: '〜' },
  { id: 'tunnel',    label: 'Tunnel',      icon: '◎' },
  { id: 'frequency', label: 'Frequency',   icon: '▐' },
  { id: 'fluid',     label: 'Fluid',       icon: '≋' },
  { id: 'fractal',   label: 'Fractal',     icon: '❊' },
  { id: 'grid',      label: 'Grid',        icon: '⊞' },
  { id: 'starfield', label: 'Starfield',   icon: '★' },
  { id: 'glitch',    label: 'Glitch',      icon: '▒' },
  { id: 'lissajous', label: 'Lissajous',   icon: '∞' },
  { id: 'custom',    label: 'Custom',      icon: '✎' },
];

export function SceneSelector() {
  const { activeScene, setScene } = useVisualStore();

  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {SCENES.map((s) => (
        <button
          key={s.id}
          onClick={() => setScene(s.id)}
          className={[
            'flex flex-col items-center justify-center gap-0.5 rounded py-1.5 text-xs transition-all',
            activeScene === s.id
              ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-500/60'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white',
          ].join(' ')}
          title={s.label}
        >
          <span className="text-base leading-none">{s.icon}</span>
          <span className="leading-none truncate w-full text-center px-0.5">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
