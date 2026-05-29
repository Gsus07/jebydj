'use client';

import React from 'react';
import { Package, Trash2 } from 'lucide-react';
import type { SamplePack } from '@/src/store/sampleTypes';
import { useSampleStore } from '@/src/store/useSampleStore';
import { BUILTIN_PACK_ID } from '@/src/lib/samples/DefaultSamples';

export function PackList() {
  const packs = useSampleStore((s) => s.packs);
  const samples = useSampleStore((s) => s.samples);
  const setFilters = useSampleStore((s) => s.setFilters);
  const removePack = useSampleStore((s) => s.removePack);
  const activePackId = useSampleStore((s) => s.filters.packId);

  const countFor = (id: string) => samples.filter((s) => s.packId === id).length;

  return (
    <div className="flex flex-col gap-0.5 py-1 px-2">
      <div className="text-[9px] uppercase tracking-widest mb-1 px-1" style={{ color: 'var(--text-muted)' }}>
        Sound Packs
      </div>
      {packs.length === 0 && (
        <div className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>
          No packs. Import a ZIP or folder.
        </div>
      )}
      {packs.map((pack) => {
        const isActive = activePackId === pack.id;
        return (
          <div
            key={pack.id}
            className="flex items-center gap-2 px-2 h-7 rounded cursor-pointer"
            style={{
              background: isActive ? 'rgba(0,245,255,0.07)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(0,245,255,0.2)' : 'transparent'}`,
            }}
            onClick={() => setFilters({ packId: isActive ? null : pack.id })}
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pack.color }} />
            <Package size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-rajdhani)' }}>
              {pack.name}
            </span>
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {countFor(pack.id)}
            </span>
            {!pack.isBuiltin && (
              <button
                className="w-4 h-4 flex items-center justify-center rounded hover:text-red-400"
                onClick={(e) => { e.stopPropagation(); if (confirm(`Delete pack "${pack.name}"?`)) removePack(pack.id); }}
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={9} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
