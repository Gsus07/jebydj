'use client';

import { useVisualStore } from '../../store/useVisualStore';
import type { PostFX } from '../../store/useVisualStore';

const FX_DEFS: { key: keyof PostFX; label: string }[] = [
  { key: 'bloom',       label: 'Bloom'    },
  { key: 'motionBlur',  label: 'Motion'   },
  { key: 'chromaticAb', label: 'Chroma'   },
  { key: 'vignette',    label: 'Vignette' },
  { key: 'filmGrain',   label: 'Grain'    },
];

export function VisualControls() {
  const { postFX, setPostFX } = useVisualStore();

  return (
    <div className="flex flex-col gap-1.5 p-2">
      {FX_DEFS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 w-14 shrink-0">{label}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={postFX[key]}
            onChange={(e) => setPostFX(key, parseFloat(e.target.value))}
            className="flex-1 h-1 accent-cyan-400"
          />
          <span className="text-[10px] text-gray-500 w-6 text-right">
            {Math.round(postFX[key] * 100)}
          </span>
        </label>
      ))}
    </div>
  );
}
