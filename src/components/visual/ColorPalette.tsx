'use client';

import { useVisualStore, PALETTES } from '../../store/useVisualStore';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

export function ColorPalette() {
  const { paletteIdx, setPalette, customPalette, setCustomColor } = useVisualStore();
  const isCustom = paletteIdx === PALETTES.length - 1;

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Preset grid */}
      <div className="grid grid-cols-5 gap-1">
        {PALETTES.map((pal, i) => (
          <button
            key={pal.name}
            onClick={() => setPalette(i)}
            title={pal.name}
            className={[
              'h-7 rounded flex gap-0.5 p-0.5 transition-all',
              paletteIdx === i ? 'ring-2 ring-cyan-400 scale-105' : 'hover:scale-105',
            ].join(' ')}
          >
            {(['colorA', 'colorB', 'colorC'] as const).map((k) => (
              <span
                key={k}
                className="flex-1 rounded-sm"
                style={{ background: `rgb(${pal[k].map((v) => Math.round(v * 255)).join(',')})` }}
              />
            ))}
          </button>
        ))}
      </div>

      {/* Custom color pickers (shown when last palette selected) */}
      {isCustom && (
        <div className="flex gap-2 items-center">
          {(['A', 'B', 'C'] as const).map((k) => {
            const key = `color${k}` as 'colorA' | 'colorB' | 'colorC';
            return (
              <label key={k} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-gray-400">{k}</span>
                <input
                  type="color"
                  value={rgbToHex(customPalette[key])}
                  onChange={(e) => setCustomColor(k, hexToRgb(e.target.value))}
                  className="w-8 h-8 rounded cursor-pointer border border-white/20"
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
