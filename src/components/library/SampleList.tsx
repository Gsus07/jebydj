'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import { SampleRow } from './SampleRow';
import type { SampleItem } from '@/src/store/sampleTypes';
import { useSampleStore } from '@/src/store/useSampleStore';
import { sampleManager } from '@/src/lib/samples/SampleManager';
import { audioEngine } from '@/src/lib/audio/AudioEngine';

const ROW_HEIGHT = 36; // px
const OVERSCAN = 3;

interface Props {
  samples: SampleItem[];
  height: number; // container pixel height
  dawMode?: boolean;
}

export function SampleList({ samples, height, dawMode = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 20 });

  const previewId  = useSampleStore((s) => s.previewSampleId);
  const previewProg = useSampleStore((s) => s.previewProgress);
  const previewVol = useSampleStore((s) => s.previewVolume);
  const selected   = useSampleStore((s) => s.selectedSampleIds);
  const setPreview = useSampleStore((s) => s.setPreview);
  const selectSamples = useSampleStore((s) => s.selectSamples);

  const totalHeight = samples.length * ROW_HEIGHT;

  const computeRange = useCallback((scrollTop: number) => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(samples.length, start + Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2);
    setVisibleRange({ start, end });
  }, [samples.length, height]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    scrollTopRef.current = el.scrollTop;
    computeRange(el.scrollTop);
  }, [computeRange]);

  useEffect(() => { computeRange(scrollTopRef.current); }, [computeRange, samples.length]);

  const playPreview = useCallback(async (sample: SampleItem) => {
    if (!audioEngine.isInitialized()) await audioEngine.initialize();
    setPreview(sample.id);
    await sampleManager.playPreview(sample.id, previewVol);
  }, [setPreview, previewVol]);

  // Keyboard shortcuts: 1-8 keys assign first 8 samples to pads
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 8 && samples[n - 1]) {
        const { dm, setRowSample } = useSampleStore.getState();
        const pattern = dm.patterns.find((p) => p.id === dm.currentPatternId);
        if (!pattern) return;
        const row = pattern.rows[n - 1];
        if (row) setRowSample(pattern.id, row.id, samples[n - 1].id);
      }
      if (e.key === 'Enter') {
        const sel = selected[0];
        const sample = sel ? samples.find((s) => s.id === sel) : samples[0];
        if (sample) void playPreview(sample);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [samples, selected, playPreview]);

  const visibleSamples = samples.slice(visibleRange.start, visibleRange.end);

  return (
    <div style={{ height, position: 'relative', overflow: 'hidden' }}>
      {/* Column header */}
      <div className="flex items-center gap-1 px-2 h-6 border-b shrink-0"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="w-7 shrink-0" />
        {dawMode && <div className="w-5 shrink-0" />}  {/* ARM */}
        <div className={`shrink-0 text-[9px] uppercase tracking-wider ${dawMode ? 'w-8' : 'w-16'}`} style={{ color: 'var(--text-muted)' }}>Wave</div>
        <div className="flex-1 text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</div>
        <div className="w-8 text-right text-[9px] uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>Dur</div>
        {!dawMode && <div className="w-8 text-right text-[9px] uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>BPM</div>}
        {!dawMode && <div className="w-6 text-right text-[9px] uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>Key</div>}
        {!dawMode && <div className="w-12 shrink-0" />}
        <div className="w-5 shrink-0" />
        {dawMode && <div className="w-6 shrink-0" />}  {/* shortcut */}
      </div>

      {/* Scrollable area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ height: height - 24, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
      >
        {samples.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs" style={{ color: 'var(--text-muted)' }}>
            No samples found
          </div>
        )}

        {/* Virtual scroll spacer */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleSamples.map((sample, i) => {
            const rowIdx = visibleRange.start + i;
            return (
              <div key={sample.id} style={{ position: 'absolute', top: rowIdx * ROW_HEIGHT, left: 0, right: 0 }}>
                <SampleRow
                  sample={sample}
                  isSelected={selected.includes(sample.id)}
                  isPreview={previewId === sample.id}
                  previewProgress={previewId === sample.id ? previewProg : 0}
                  dawMode={dawMode}
                  onClick={() => {
                    selectSamples([sample.id]);
                    void playPreview(sample);
                  }}
                  onDoubleClick={() => {
                    selectSamples([sample.id]);
                    void playPreview(sample);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
