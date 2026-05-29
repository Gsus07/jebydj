'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Search, Upload, X, Filter, RefreshCw } from 'lucide-react';
import { CategoryTree } from './CategoryTree';
import { PackList } from './PackList';
import { SampleList } from './SampleList';
import { SamplePreview } from './SamplePreview';
import { TagCloud } from './TagCloud';
import { useSampleStore, getFilteredSamples } from '@/src/store/useSampleStore';
import { importDroppedItems, importFiles } from '@/src/lib/samples/PackImporter';
import { generateBuiltinSamples, BUILTIN_PACK_ID } from '@/src/lib/samples/DefaultSamples';
import { isBuiltinGenerated, dbLoadAllSamples, dbLoadAllPacks } from '@/src/lib/samples/SampleDatabase';
import type { SamplePack } from '@/src/store/sampleTypes';

export function SampleBrowser({ dawMode = false }: { dawMode?: boolean }) {
  const store = useSampleStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [listHeight, setListHeight] = useState(300);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // ── Initialize: load IndexedDB + generate builtin samples on first run ──────
  useEffect(() => {
    (async () => {
      // Load persisted packs + samples
      const [packs, samples] = await Promise.all([dbLoadAllPacks(), dbLoadAllSamples()]);
      for (const p of packs) if (!store.packs.find((x) => x.id === p.id)) store.addPack(p);
      if (samples.length > 0) store.addSamples(samples.filter((s) => !store.samples.find((x) => x.id === s.id)));

      // Generate builtin samples if first time
      const generated = await isBuiltinGenerated();
      if (!generated && !store.packs.find((p) => p.id === BUILTIN_PACK_ID)) {
        store.setImportProgress(0, 20, true);
        const items = await generateBuiltinSamples((cur, total) => store.setImportProgress(cur, total, true));
        store.addSamples(items);
        const builtinPack: SamplePack = {
          id: BUILTIN_PACK_ID, name: 'Built-in Sounds',
          description: 'Procedurally generated drum sounds & FX',
          color: '#00f5ff', isBuiltin: true,
          sampleCount: items.length, importedAt: Date.now(),
        };
        store.addPack(builtinPack);
        store.setImportProgress(20, 20, false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 400;
      setContainerHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setListHeight(entries[0]?.contentRect.height ?? 300);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Drag and drop import ──────────────────────────────────────────────────
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Check if dragging a sample-id (internal drag from sample list)
    const sampleId = e.dataTransfer.getData('application/x-sample-id');
    if (sampleId) return; // internal drag, not an import

    store.setImportProgress(0, 1, true);
    const result = await importDroppedItems(e.dataTransfer.items, (cur, total) =>
      store.setImportProgress(cur, total, true),
    );
    if (result) {
      store.addPack(result.pack);
      store.addSamples(result.samples);
    }
    store.setImportProgress(0, 0, false);
  }, [store]);

  // ── File picker import ────────────────────────────────────────────────────
  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    store.setImportProgress(0, files.length, true);
    const packId = 'user-' + Date.now();
    const items = await importFiles(files, packId, (cur, total) =>
      store.setImportProgress(cur, total, true),
    );
    if (items.length > 0) {
      const pack: SamplePack = {
        id: packId, name: `Imported ${new Date().toLocaleDateString()}`,
        description: `${items.length} files`,
        color: '#ff006e', isBuiltin: false,
        sampleCount: items.length, importedAt: Date.now(),
      };
      store.addPack(pack);
      store.addSamples(items);
    }
    store.setImportProgress(0, 0, false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [store]);

  // ── Filtered samples ──────────────────────────────────────────────────────
  const filtered = getFilteredSamples(store.samples, store.filters, store.sortColumn, store.sortDirection);

  // ── All tags from current filtered set ────────────────────────────────────
  const allTags = React.useMemo(() => {
    const tagMap = new Map<string, number>();
    for (const s of filtered) for (const t of s.tags) tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    return Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t]) => t);
  }, [filtered]);

  const { importProgress } = store;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-primary)', fontFamily: 'var(--font-rajdhani)' }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed pointer-events-none"
          style={{ background: 'rgba(0,245,255,0.05)', borderColor: 'var(--accent-cyan)' }}>
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--accent-cyan)' }}>
            Drop to import
          </span>
        </div>
      )}

      {/* Top toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1 flex-1 rounded px-2 h-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Search size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search samples…"
            value={store.filters.search}
            onChange={(e) => store.setFilters({ search: e.target.value })}
            className="bg-transparent outline-none text-[11px] flex-1 min-w-0"
            style={{ color: 'var(--text-primary)' }}
          />
          {store.filters.search && (
            <button onClick={() => store.setFilters({ search: '' })}>
              <X size={9} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
        <button
          className="w-6 h-6 flex items-center justify-center rounded"
          style={{ background: showTags ? 'rgba(0,245,255,0.1)' : 'var(--bg-surface)', border: '1px solid var(--border)', color: showTags ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
          onClick={() => setShowTags((v) => !v)}
          title="Toggle tag filter"
        >
          <Filter size={10} />
        </button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          onClick={() => fileInputRef.current?.click()}
          title="Import audio files"
        >
          <Upload size={10} />
        </button>
        <input ref={fileInputRef} type="file" multiple accept="audio/*,.zip" className="hidden" onChange={handleFileInput} />
      </div>

      {/* Import progress */}
      {importProgress.active && (
        <div className="px-2 py-1 shrink-0">
          <div className="flex justify-between text-[9px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
            <span>Importing…</span>
            <span>{importProgress.current} / {importProgress.total}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
              background: 'var(--accent-cyan)',
            }} />
          </div>
        </div>
      )}

      {/* Main content: categories + sample list */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: category tree + pack list */}
        <div className="flex flex-col shrink-0 overflow-y-auto border-r" style={{ width: 'clamp(90px, 35%, 120px)', borderColor: 'var(--border)' }}>
          <CategoryTree />
          <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }}>
            <PackList />
          </div>
        </div>

        {/* Right: tags + sample list */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {showTags && allTags.length > 0 && (
            <div className="border-b shrink-0 max-h-16 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              <TagCloud tags={allTags} selectedTags={store.filters.tags} />
            </div>
          )}

          {/* Sample count */}
          <div className="flex items-center justify-between px-2 py-0.5 shrink-0">
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {filtered.length} sample{filtered.length !== 1 ? 's' : ''}
            </span>
            {(store.filters.tags.length > 0 || store.filters.search || store.filters.category !== 'all') && (
              <button
                className="flex items-center gap-1 text-[9px] hover:text-cyan-400"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => store.resetFilters()}
              >
                <RefreshCw size={8} />clear
              </button>
            )}
          </div>

          {/* Virtual scroll list */}
          <div ref={listContainerRef} className="flex-1 min-h-0 overflow-hidden">
            <SampleList samples={filtered} height={listHeight} dawMode={dawMode} />
          </div>
        </div>
      </div>

      {/* Preview bar at bottom */}
      <SamplePreview />
    </div>
  );
}
