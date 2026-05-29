'use client';

import React, { useState, useCallback } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import { bounceProject, downloadAudioFile } from '@/src/lib/daw/Exporter';
import { X, Download } from 'lucide-react';
import type { ExportOptions, ExportFormat, BitDepth, ExportChannels } from '@/src/store/dawTypes';

export default function ExportModal() {
  const store = useDAWStore();
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const [format, setFormat] = useState<ExportFormat>('wav');
  const [bitDepth, setBitDepth] = useState<BitDepth>(24);
  const [sampleRate, setSampleRate] = useState<44100 | 48000 | 88200 | 96000>(44100);
  const [kbps, setKbps] = useState(320);
  const [normalize, setNormalize] = useState(false);
  const [useLoop, setUseLoop] = useState(true);

  const { project } = store;
  const startBeat = useLoop && project.loopEnabled ? project.loopStart : 0;
  const endBeat = useLoop && project.loopEnabled ? project.loopEnd : project.totalBeats;

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError('');
    setProgress(0);

    const options: ExportOptions = {
      startBeat,
      endBeat,
      format,
      sampleRate,
      bitDepth,
      channels: 'stereo',
      normalize,
      kbps,
    };

    try {
      const buffer = await bounceProject(project, options, setProgress);
      const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      const ext = format === 'mp3' ? 'mp3' : 'wav';
      downloadAudioFile(buffer, `${project.name}.${ext}`, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
      setProgress(0);
    }
  }, [project, startBeat, endBeat, format, sampleRate, bitDepth, normalize, kbps]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
    >
      <div
        className="flex flex-col rounded-xl border"
        style={{
          width: 380,
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
          fontFamily: 'var(--font-rajdhani)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Download size={14} style={{ color: 'var(--accent-cyan)' }} />
            <span className="font-bold uppercase tracking-widest text-sm" style={{ color: 'var(--text-primary)' }}>
              Export Project
            </span>
          </div>
          <button onClick={() => store.setShowExport(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10">
            <X size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 p-4">
          {/* Format */}
          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-widest w-20" style={{ color: 'var(--text-muted)' }}>Format</label>
            <div className="flex gap-2">
              {(['wav', 'mp3'] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  className="px-3 py-1 rounded text-xs font-bold uppercase"
                  style={{
                    background: format === f ? 'var(--accent-cyan)' : 'var(--bg-surface)',
                    color: format === f ? '#000' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Sample rate */}
          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-widest w-20" style={{ color: 'var(--text-muted)' }}>Sample Rate</label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(parseInt(e.target.value) as 44100 | 48000 | 88200 | 96000)}
              className="text-xs rounded px-2 h-7 outline-none cursor-pointer"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <option value={44100}>44.1 kHz</option>
              <option value={48000}>48 kHz</option>
              <option value={96000}>96 kHz</option>
            </select>
          </div>

          {/* Bit depth (WAV only) */}
          {format === 'wav' && (
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-widest w-20" style={{ color: 'var(--text-muted)' }}>Bit Depth</label>
              <div className="flex gap-2">
                {([16, 24, 32] as BitDepth[]).map((b) => (
                  <button
                    key={b}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      background: bitDepth === b ? 'rgba(0,245,255,0.15)' : 'var(--bg-surface)',
                      color: bitDepth === b ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      border: `1px solid ${bitDepth === b ? 'var(--accent-cyan)' : 'var(--border)'}`,
                    }}
                    onClick={() => setBitDepth(b)}
                  >
                    {b}-bit
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MP3 bitrate */}
          {format === 'mp3' && (
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-widest w-20" style={{ color: 'var(--text-muted)' }}>Bitrate</label>
              <select
                value={kbps}
                onChange={(e) => setKbps(parseInt(e.target.value))}
                className="text-xs rounded px-2 h-7 outline-none cursor-pointer"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                <option value={128}>128 kbps</option>
                <option value={192}>192 kbps</option>
                <option value={256}>256 kbps</option>
                <option value={320}>320 kbps</option>
              </select>
            </div>
          )}

          {/* Region */}
          <div className="flex items-center gap-3">
            <label className="text-xs uppercase tracking-widest w-20" style={{ color: 'var(--text-muted)' }}>Region</label>
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={useLoop && project.loopEnabled} onChange={(e) => setUseLoop(e.target.checked)} className="w-3 h-3" disabled={!project.loopEnabled} />
              Use loop region
            </label>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {startBeat.toFixed(1)} – {endBeat.toFixed(1)} beats
            </span>
          </div>

          {/* Progress */}
          {exporting && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Rendering…</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress * 100}%`, background: 'var(--accent-cyan)' }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs rounded p-2" style={{ background: 'rgba(255,68,68,0.1)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            className="px-4 py-2 rounded text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            onClick={() => store.setShowExport(false)}
            disabled={exporting}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-bold"
            style={{
              background: exporting ? 'var(--bg-surface)' : 'var(--accent-cyan)',
              color: exporting ? 'var(--text-muted)' : '#000',
              border: '1px solid var(--border)',
              cursor: exporting ? 'not-allowed' : 'pointer',
            }}
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
