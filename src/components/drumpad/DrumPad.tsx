'use client';

import React, { useState } from 'react';
import type { DrumStep } from '@/src/store/sampleTypes';
import { useSampleStore } from '@/src/store/useSampleStore';

interface StepPopupProps {
  step: DrumStep;
  patternId: string;
  rowId: string;
  stepIdx: number;
  onClose: () => void;
}

function StepPopup({ step, patternId, rowId, stepIdx, onClose }: StepPopupProps) {
  const updateStep = useSampleStore((s) => s.updateStep);

  return (
    <div
      className="absolute z-50 rounded-lg border p-3 flex flex-col gap-2 shadow-xl"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', width: 180, bottom: '110%', left: '-30px' }}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-cyan)' }}>
        Step {stepIdx + 1}
      </div>

      {[
        { label: 'Velocity', key: 'velocity' as const, min: 0, max: 127 },
        { label: 'Pitch', key: 'pitch' as const, min: -24, max: 24 },
        { label: 'Probability', key: 'probability' as const, min: 0, max: 100 },
        { label: 'Offset %', key: 'offset' as const, min: -50, max: 50 },
      ].map(({ label, key, min, max }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-[9px] w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
          <input
            type="range" min={min} max={max}
            value={step[key] as number}
            className="flex-1 h-1 accent-cyan-400 cursor-pointer"
            onChange={(e) => updateStep(patternId, rowId, stepIdx, { [key]: parseInt(e.target.value) })}
          />
          <span className="text-[9px] w-5 text-right" style={{ color: 'var(--text-primary)' }}>
            {step[key] as number}
          </span>
        </div>
      ))}

      {[
        { label: 'Retrigger', key: 'retrigger' as const, options: [1, 2, 3, 4] },
      ].map(({ label, key, options }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-[9px] w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
          <div className="flex gap-1">
            {options.map((v) => (
              <button
                key={v}
                className="w-5 h-5 rounded text-[10px]"
                style={{
                  background: step[key] === v ? 'var(--accent-cyan)' : 'var(--bg-surface)',
                  color: step[key] === v ? '#000' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
                onClick={() => updateStep(patternId, rowId, stepIdx, { [key]: v })}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <span className="text-[9px] w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>Flam</span>
        <button
          className="w-8 h-4 rounded-full transition-all"
          style={{ background: step.flam ? 'var(--accent-cyan)' : 'var(--bg-surface)', border: '1px solid var(--border)' }}
          onClick={() => updateStep(patternId, rowId, stepIdx, { flam: !step.flam })}
        >
          <div className="w-3 h-3 rounded-full mx-auto" style={{ background: step.flam ? '#000' : 'var(--text-muted)', transform: step.flam ? 'translateX(4px)' : 'translateX(-4px)', transition: 'transform 0.15s' }} />
        </button>
      </div>

      <button onClick={onClose} className="text-[9px] mt-1 hover:text-white" style={{ color: 'var(--text-muted)' }}>
        Close
      </button>
    </div>
  );
}

// ─── DrumPad ──────────────────────────────────────────────────────────────────

interface Props {
  step: DrumStep;
  stepIdx: number;
  patternId: string;
  rowId: string;
  isCurrentStep: boolean;
  stepCount: number;
}

export function DrumPad({ step, stepIdx, patternId, rowId, isCurrentStep, stepCount }: Props) {
  const [showPopup, setShowPopup] = useState(false);
  const toggleStep = useSampleStore((s) => s.toggleStep);

  const barStyle = stepCount > 16 ? { width: 12, height: 12 } : { width: 20, height: 28 };

  // Beat grouping: every 4 steps has a slightly different bg
  const beatGroup = Math.floor(stepIdx / 4) % 2;

  const velAlpha = step.on ? (step.velocity / 127) : 0;
  const bg = step.on
    ? `rgba(0,245,255,${0.2 + velAlpha * 0.65})`
    : beatGroup === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';

  return (
    <div className="relative">
      <button
        className="rounded transition-all cursor-pointer"
        style={{
          ...barStyle,
          background: bg,
          border: isCurrentStep
            ? '2px solid var(--accent-cyan)'
            : step.on ? '1px solid rgba(0,245,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isCurrentStep ? '0 0 6px rgba(0,245,255,0.5)' : 'none',
          opacity: step.on && step.probability < 100 ? 0.7 : 1,
        }}
        onClick={() => toggleStep(patternId, rowId, stepIdx)}
        onContextMenu={(e) => { e.preventDefault(); setShowPopup((v) => !v); }}
        title={`Step ${stepIdx + 1} | vel:${step.velocity} | prob:${step.probability}%`}
      />
      {showPopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPopup(false)} />
          <StepPopup
            step={step} patternId={patternId} rowId={rowId}
            stepIdx={stepIdx} onClose={() => setShowPopup(false)}
          />
        </>
      )}
    </div>
  );
}
