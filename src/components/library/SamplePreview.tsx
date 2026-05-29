'use client';

import React from 'react';
import { Square, Volume2 } from 'lucide-react';
import { WaveformThumb } from './WaveformThumb';
import { useSampleStore } from '@/src/store/useSampleStore';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import { audioEngine } from '@/src/lib/audio/AudioEngine';

export function SamplePreview() {
  const previewId = useSampleStore((s) => s.previewSampleId);
  const progress  = useSampleStore((s) => s.previewProgress);
  const volume    = useSampleStore((s) => s.previewVolume);
  const setVol    = useSampleStore((s) => s.setPreviewVolume);
  const samples   = useSampleStore((s) => s.samples);

  const sample = samples.find((s) => s.id === previewId);

  const stop = () => {
    sampleManager.stopPreview();
    useSampleStore.getState().setPreview(null);
  };

  if (!sample) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-t text-[10px]"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <Volume2 size={11} />
        <span>No preview</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={volume}
          onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); sampleManager.setPreviewVolume(v); }}
          className="w-16 h-1 accent-cyan-400 ml-auto cursor-pointer"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-3 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        <button onClick={stop} className="flex items-center justify-center w-5 h-5 rounded"
          style={{ background: 'rgba(255,0,110,0.15)', color: '#ff006e' }}>
          <Square size={8} fill="#ff006e" />
        </button>
        <span className="text-[10px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
          {sample.name}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {sample.duration.toFixed(2)}s
        </span>
        <Volume2 size={10} style={{ color: 'var(--text-muted)' }} />
        <input
          type="range" min={0} max={1} step={0.01}
          value={volume}
          onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); sampleManager.setPreviewVolume(v); }}
          className="w-14 h-1 accent-cyan-400 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <WaveformThumb waveformData={sample.waveformData} progress={progress} color="#00f5ff" width={274} height={20} />
    </div>
  );
}
