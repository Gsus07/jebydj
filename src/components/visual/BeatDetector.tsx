'use client';

import { useAudioReactor } from '../../hooks/visual/useAudioReactor';

export function BeatDetector() {
  const data = useAudioReactor();

  const bars = [
    { label: 'Bass',  value: data.bass  },
    { label: 'Mid',   value: data.mid   },
    { label: 'High',  value: data.high  },
  ];

  return (
    <div className="flex items-center gap-3 px-2 py-1">
      {/* Beat flash indicator */}
      <div
        className={[
          'w-4 h-4 rounded-full border transition-all duration-75',
          data.isBeat
            ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_8px_cyan]'
            : 'bg-transparent border-white/20',
        ].join(' ')}
        title="Beat"
      />
      <span className="text-[10px] text-gray-500">{Math.round(data.bpm)} BPM</span>

      {/* Band meters */}
      <div className="flex gap-1 items-end h-4">
        {bars.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center gap-0.5" title={label}>
            <div
              className="w-2 bg-cyan-400/70 rounded-sm transition-all duration-75"
              style={{ height: `${Math.round(value * 16)}px`, minHeight: 1 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
