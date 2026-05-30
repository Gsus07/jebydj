'use client';

import { useCallback } from 'react';
import { useDJStore } from '@/src/store/useDJStore';
import { Knob } from '@/src/components/ui/Knob';
import { LEDButton } from '@/src/components/ui/LEDButton';
import type { EffectState, EffectTarget } from '@/src/store/types';

const EFFECT_COLORS: Record<string, string> = {
  reverb: '#00f5ff',
  delay: '#ffbe0b',
  filter: '#8338ec',
  flanger: '#06d6a0',
  bitcrusher: '#ff006e',
  phaser: '#fb5607',
};

const EFFECT_LABELS: Record<string, string> = {
  reverb: 'REVERB',
  delay: 'DELAY',
  filter: 'AUTO FILTER',
  flanger: 'FLANGER',
  bitcrusher: 'BITCRUSH',
  phaser: 'PHASER',
};

const PARAM_LABELS: Record<string, Record<string, string>> = {
  reverb: { roomSize: 'SIZE', damping: 'DAMP', wetDry: 'WET' },
  delay: { time: 'TIME', feedback: 'FDBK', wetDry: 'WET' },
  filter: { frequency: 'FREQ', rate: 'RATE', depth: 'DEPTH' },
  flanger: { rate: 'RATE', depth: 'DEPTH', feedback: 'FDBK', wetDry: 'WET' },
  bitcrusher: { bitDepth: 'BITS', sampleRateReduction: 'RATE' },
  phaser: { stages: 'STGS', rate: 'RATE', depth: 'DEPTH', wetDry: 'WET' },
};

const PARAM_RANGES: Record<string, Record<string, [number, number]>> = {
  reverb: { roomSize: [0.1, 4], damping: [0, 100], wetDry: [0, 1] },
  delay: { time: [1, 2000], feedback: [0, 95], wetDry: [0, 1] },
  filter: { frequency: [20, 20000], rate: [0.1, 20], depth: [0, 100] },
  flanger: { rate: [0.1, 10], depth: [0.5, 10], feedback: [0, 95], wetDry: [0, 1] },
  bitcrusher: { bitDepth: [1, 16], sampleRateReduction: [1, 32] },
  phaser: { stages: [2, 8], rate: [0.1, 10], depth: [0, 100], wetDry: [0, 1] },
};

interface EffectUnitProps {
  effect: EffectState;
}

function EffectUnit({ effect }: EffectUnitProps) {
  const { setEffectEnabled, setEffectTarget, setEffectParam } = useDJStore.getState();
  const color = EFFECT_COLORS[effect.type] ?? '#00f5ff';
  const label = EFFECT_LABELS[effect.type] ?? effect.type.toUpperCase();
  const paramLabels = PARAM_LABELS[effect.type] ?? {};
  const paramRanges = PARAM_RANGES[effect.type] ?? {};

  const toKnob = (key: string, value: number): number => {
    const [min, max] = paramRanges[key] ?? [0, 1];
    return (value - min) / (max - min);
  };

  const fromKnob = (key: string, knobValue: number): number => {
    const [min, max] = paramRanges[key] ?? [0, 1];
    return min + knobValue * (max - min);
  };

  return (
    <div
      className="flex flex-col gap-2 p-2 rounded-lg w-full"
      style={{
        backgroundColor: '#111118',
        border: `1px solid ${effect.enabled ? color : '#2a2a3a'}`,
        boxShadow: effect.enabled ? `0 0 12px ${color}33` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-rajdhani font-bold uppercase truncate"
          style={{ color: effect.enabled ? color : '#555566' }}
        >
          {label}
        </span>
        <LEDButton
          active={effect.enabled}
          color={color}
          onClick={() => setEffectEnabled(effect.id, !effect.enabled)}
          size="sm"
        >
          {effect.enabled ? 'ON' : 'OFF'}
        </LEDButton>
      </div>

      {/* Target selector */}
      <div className="flex gap-1">
        {(['A', 'B', 'master'] as EffectTarget[]).map((t) => (
          <button
            key={t}
            onClick={() => setEffectTarget(effect.id, t)}
            className="flex-1 text-[8px] font-rajdhani rounded py-0.5 border uppercase"
            style={{
              borderColor: effect.target === t ? color : '#2a2a3a',
              color: effect.target === t ? color : '#555566',
              backgroundColor: effect.target === t ? `${color}22` : 'transparent',
            }}
          >
            {t === 'master' ? 'MST' : t}
          </button>
        ))}
      </div>

      {/* Param knobs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {Object.entries(paramLabels).map(([key, lbl]) => (
          <Knob
            key={key}
            value={toKnob(key, effect.params[key] ?? 0.5)}
            onChange={(v) => setEffectParam(effect.id, key, fromKnob(key, v))}
            size={34}
            label={lbl}
            color={color}
            disabled={!effect.enabled}
          />
        ))}
      </div>
    </div>
  );
}

export function EffectsRack() {
  const effects = useDJStore((s) => s.effects);

  return (
    <div className="p-2 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3a' }}>
      <div className="text-[9px] font-rajdhani text-muted uppercase tracking-widest mb-2 text-center">
        EFFECTS RACK
      </div>
      <div className="effects-rack-scroll">
        {effects.map((effect) => (
          <div key={effect.id} className="effect-unit">
            <EffectUnit effect={effect} />
          </div>
        ))}
      </div>
    </div>
  );
}
