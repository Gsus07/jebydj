'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { Disc3, Sliders, Zap, Library, Music2 } from 'lucide-react';
import { Deck } from '@/src/components/deck/Deck';
import { Mixer } from '@/src/components/mixer/Mixer';
import { EffectsRack } from '@/src/components/effects/EffectsRack';
import { TrackLibrary } from '@/src/components/library/TrackLibrary';
import { useDJStore } from '@/src/store/useDJStore';
import { CamelotWheel } from '@/src/components/library/CamelotWheel';

const SampleBrowser = dynamic(
  () => import('@/src/components/library/SampleBrowser').then((m) => ({ default: m.SampleBrowser })),
  { ssr: false },
);

type Tab = 'deckA' | 'mix' | 'deckB' | 'fx' | 'lib';

const TABS: { id: Tab; label: string; Icon: React.ElementType; colorA?: string; colorB?: string }[] = [
  { id: 'deckA', label: 'DECK A', Icon: Disc3,    colorA: '#00f5ff' },
  { id: 'mix',   label: 'MIX',    Icon: Sliders,  colorA: '#ffbe0b' },
  { id: 'deckB', label: 'DECK B', Icon: Disc3,    colorA: '#ff006e' },
  { id: 'fx',    label: 'FX',     Icon: Zap,      colorA: '#a855f7' },
  { id: 'lib',   label: 'LIB',    Icon: Library,  colorA: '#22c55e' },
];

export function MobileDJLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('deckA');
  const [libTab, setLibTab] = useState<'tracks' | 'samples'>('tracks');

  const activeColor = TABS.find((t) => t.id === activeTab)?.colorA ?? '#00f5ff';

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── Scrollable content area ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            className="w-full h-full overflow-y-auto overflow-x-hidden"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'deckA' && (
              <div className="p-2">
                <Deck deckId="A" />
              </div>
            )}

            {activeTab === 'mix' && (
              <div className="p-2">
                <Mixer />
              </div>
            )}

            {activeTab === 'deckB' && (
              <div className="p-2">
                <Deck deckId="B" />
              </div>
            )}

            {activeTab === 'fx' && (
              <div className="p-2">
                <EffectsRack />
              </div>
            )}

            {activeTab === 'lib' && (
              <div className="flex flex-col h-full min-h-0">
                {/* Sub-tabs */}
                <div
                  className="flex shrink-0 border-b"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                >
                  {(['tracks', 'samples'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setLibTab(t)}
                      className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
                      style={{
                        fontFamily: 'var(--font-orbitron)',
                        borderBottom: libTab === t ? '2px solid #22c55e' : '2px solid transparent',
                        color: libTab === t ? '#22c55e' : 'var(--text-muted)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-hidden">
                  {libTab === 'tracks' ? (
                    <>
                      <TrackLibrary />
                      <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <CamelotWheel />
                      </div>
                    </>
                  ) : (
                    <SampleBrowser />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom tab bar ── */}
      <nav
        className="flex shrink-0 border-t"
        style={{
          borderColor: 'var(--border)',
          background: '#0d0d14',
          height: 'var(--mobile-tab-height)',
        }}
      >
        {TABS.map(({ id, label, Icon, colorA }) => {
          const isActive = activeTab === id;
          const color = isActive ? colorA : 'var(--text-muted)';
          return (
            <button
              key={id}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{
                color,
                background: isActive ? `${colorA}0d` : 'transparent',
                borderTop: isActive ? `2px solid ${colorA}` : '2px solid transparent',
                // Ensure min 44px touch target
                minHeight: 44,
              }}
              onClick={() => setActiveTab(id)}
              aria-label={label}
            >
              <Icon size={18} />
              <span
                style={{
                  fontSize: 8,
                  fontFamily: 'var(--font-orbitron)',
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
