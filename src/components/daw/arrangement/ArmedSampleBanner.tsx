'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDAWStore } from '@/src/store/useDAWStore';
import { WaveformThumb } from '@/src/components/library/WaveformThumb';

interface Props {
  insertCount: number;
}

export function ArmedSampleBanner({ insertCount }: Props) {
  const armedSample = useDAWStore((s) => s.armedSample);
  const disarmSample = useDAWStore((s) => s.disarmSample);

  const dur = armedSample
    ? armedSample.duration < 1
      ? `${(armedSample.duration * 1000).toFixed(0)}ms`
      : `${armedSample.duration.toFixed(1)}s`
    : '';

  return (
    <AnimatePresence>
      {armedSample && (
        <motion.div
          key="armed-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 36, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            background: `${armedSample.color}18`,
            borderBottom: `1px solid ${armedSample.color}55`,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div
            className="flex items-center gap-2 px-3 h-9"
            style={{ fontFamily: 'var(--font-rajdhani, sans-serif)' }}
          >
            {/* Mini waveform */}
            <WaveformThumb
              waveformData={armedSample.waveformData}
              progress={0}
              color={armedSample.color}
              width={60}
              height={20}
            />

            {/* Pin icon */}
            <span style={{ color: armedSample.color, fontSize: 13 }}>📌</span>

            {/* Name */}
            <span style={{ color: armedSample.color, fontSize: 12, fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {armedSample.name}
            </span>

            {/* Duration */}
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {dur}
            </span>

            {/* Insert count */}
            {insertCount > 0 && (
              <span style={{ color: armedSample.color, fontSize: 11, opacity: 0.8 }}>
                · {insertCount} insertado{insertCount !== 1 ? 's' : ''}
              </span>
            )}

            {/* Instructions */}
            <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.6 }}>
              · Click en el timeline para insertar · Arrastra para rellenar · Esc para cancelar
            </span>

            <div style={{ flex: 1 }} />

            {/* Disarm button */}
            <button
              onClick={() => disarmSample()}
              className="flex items-center gap-1 rounded transition-all hover:opacity-80"
              style={{
                background: `${armedSample.color}22`,
                border: `1px solid ${armedSample.color}44`,
                color: armedSample.color,
                fontSize: 11,
                padding: '2px 8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-rajdhani, sans-serif)',
              }}
            >
              ✕ Soltar
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
