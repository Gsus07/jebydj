'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useDAWStore } from '@/src/store/useDAWStore';
import dynamic from 'next/dynamic';
import TransportBar from './transport/TransportBar';
import ArrangementView from './arrangement/ArrangementView';
import ClipLauncher from './launcher/ClipLauncher';
import PianoRoll from './pianoroll/PianoRoll';
import DAWMixer from './mixer/DAWMixer';
import ExportModal from './ExportModal';
import { TrackLibrary } from '@/src/components/library/TrackLibrary';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { Layers, Grid3X3, Sliders, Download, FileText, Grid, ChevronLeft, ChevronRight, BookOpen, LayoutList, Network, ClipboardList, History } from 'lucide-react';
import Patcher from '../patcher/Patcher';
import { ScoreLog } from '../utility/ScoreLog';
import { UndoTree } from '../utility/UndoTree';
import { FloatingWindow } from '../utility/FloatingWindow';

const ChannelRack = dynamic(
  () => import('@/src/components/channel-rack/ChannelRack'),
  { ssr: false },
);

const SampleBrowser = dynamic(
  () => import('@/src/components/library/SampleBrowser').then((m) => ({ default: m.SampleBrowser })),
  { ssr: false },
);
const DrumMachine = dynamic(
  () => import('@/src/components/drumpad/DrumMachine').then((m) => ({ default: m.DrumMachine })),
  { ssr: false },
);

export default function DAWLayout() {
  const store = useDAWStore();
  const {
    view, pianoRollOpen, mixerOpen, showExportModal,
    project, hasUnsavedChanges,
  } = store;

  const [libTab, setLibTab] = useState<'tracks' | 'samples'>('tracks');
  const [libCollapsed, setLibCollapsed] = useState(false);
  const [drumOpen, setDrumOpen] = useState(false);
  const channelRackOpen = useChannelRackStore((s) => s.channelRackOpen);
  const setChannelRackOpen = useChannelRackStore((s) => s.setChannelRackOpen);
  const [patcherOpen, setPatcherOpen] = useState(false);
  const [scoreLogOpen, setScoreLogOpen] = useState(false);
  const [undoTreeOpen, setUndoTreeOpen] = useState(false);

  // Collapse library by default on narrow/landscape-mobile viewports
  useEffect(() => {
    const mq = window.matchMedia(
      '(max-width: 767px), (max-height: 500px) and (orientation: landscape)',
    );
    if (mq.matches) setLibCollapsed(true);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setLibCollapsed(true); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Global DAW keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Tab: toggle arrangement / session
      if (e.key === 'Tab' && !e.ctrlKey) {
        e.preventDefault();
        store.setView(view === 'arrangement' ? 'session' : 'arrangement');
      }
      // Ctrl+P: piano roll
      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        if (store.selectedClipIds.length > 0) {
          store.setPianoRollOpen(!pianoRollOpen, store.selectedClipIds[0]);
        } else {
          store.setPianoRollOpen(!pianoRollOpen);
        }
      }
      // Ctrl+M: mixer
      if (e.key === 'm' && e.ctrlKey) {
        e.preventDefault();
        store.setMixerOpen(!mixerOpen);
      }
      // Ctrl+E: export
      if (e.key === 'e' && e.ctrlKey) {
        e.preventDefault();
        store.setShowExport(true);
      }
      // Ctrl+R: channel rack
      if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        setChannelRackOpen(!channelRackOpen);
      }
      // Ctrl+D: drum machine
      if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        setDrumOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => window.removeEventListener('keydown', handler);
  }, [store, view, pianoRollOpen, mixerOpen]);

  const viewBtnStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    background: active ? 'rgba(0,245,255,0.1)' : 'transparent',
    color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
    border: `1px solid ${active ? 'var(--accent-cyan)' : 'transparent'}`,
    cursor: 'pointer' as const,
    fontFamily: 'var(--font-rajdhani)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    fontWeight: active ? 700 : 400,
  });

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ background: 'var(--bg-primary)', fontFamily: 'var(--font-rajdhani)' }}
    >
      {/* Sub-header: view tabs + project info */}
      <div
        className="daw-hscroll daw-subheader flex items-center gap-1 px-2 min-h-8 shrink-0 border-b"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', paddingTop: 2, paddingBottom: 2 }}
      >
        {/* View tabs */}
        <button style={viewBtnStyle(view === 'arrangement')} onClick={() => store.setView('arrangement')}>
          <Layers size={11} /> Arrangement
        </button>
        <button style={viewBtnStyle(view === 'session')} onClick={() => store.setView('session')}>
          <Grid3X3 size={11} /> Session
        </button>

        <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />

        {/* Project name */}
        <input
          value={project.name}
          onChange={(e) => store.setProjectName(e.target.value)}
          className="bg-transparent outline-none text-xs"
          style={{ color: hasUnsavedChanges ? 'var(--accent-amber)' : 'var(--text-muted)', fontFamily: 'var(--font-rajdhani)' }}
        />
        {hasUnsavedChanges && <span className="text-[9px]" style={{ color: 'var(--accent-amber)' }}>●</span>}

        <div className="flex-1" />

        {/* Panel toggles */}
        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded"
          style={{
            background: drumOpen ? 'rgba(255,0,110,0.1)' : 'transparent',
            color: drumOpen ? 'var(--accent-magenta)' : 'var(--text-muted)',
            border: `1px solid ${drumOpen ? 'var(--accent-magenta)' : 'transparent'}`,
          }}
          onClick={() => setDrumOpen((v) => !v)}
          title="Toggle Drum Machine (Ctrl+D)"
        >
          <Grid size={10} /> DRUM
        </button>

        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded"
          style={{
            background: channelRackOpen ? 'rgba(255,0,110,0.1)' : 'transparent',
            color: channelRackOpen ? 'var(--accent-magenta)' : 'var(--text-muted)',
            border: `1px solid ${channelRackOpen ? 'var(--accent-magenta)' : 'transparent'}`,
          }}
          onClick={() => setChannelRackOpen(!channelRackOpen)}
          title="Toggle Channel Rack (Ctrl+R)"
        >
          <LayoutList size={10} /> CH.RACK
        </button>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border)' }} />

        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded"
          style={{
            background: mixerOpen ? 'rgba(0,245,255,0.1)' : 'transparent',
            color: mixerOpen ? 'var(--accent-cyan)' : 'var(--text-muted)',
            border: `1px solid ${mixerOpen ? 'var(--accent-cyan)' : 'transparent'}`,
          }}
          onClick={() => store.setMixerOpen(!mixerOpen)}
          title="Toggle Mixer (Ctrl+M)"
        >
          <Sliders size={10} /> MIXER
        </button>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border)' }} />

        {/* Patcher */}
        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded"
          style={{
            background: patcherOpen ? 'rgba(0,245,255,0.1)' : 'transparent',
            color: patcherOpen ? 'var(--accent-cyan)' : 'var(--text-muted)',
            border: `1px solid ${patcherOpen ? 'var(--accent-cyan)' : 'transparent'}`,
          }}
          onClick={() => setPatcherOpen(!patcherOpen)}
          title="Toggle Patcher"
        >
          <Network size={10} /> PATCHER
        </button>

        {/* Score Log */}
        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded"
          style={{
            background: scoreLogOpen ? 'rgba(255,190,11,0.1)' : 'transparent',
            color: scoreLogOpen ? '#ffbe0b' : 'var(--text-muted)',
            border: `1px solid ${scoreLogOpen ? '#ffbe0b' : 'transparent'}`,
          }}
          onClick={() => setScoreLogOpen(!scoreLogOpen)}
          title="Toggle Score Log"
        >
          <ClipboardList size={10} /> LOG
        </button>

        {/* Undo Tree */}
        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded"
          style={{
            background: undoTreeOpen ? 'rgba(255,0,110,0.1)' : 'transparent',
            color: undoTreeOpen ? 'var(--accent-magenta)' : 'var(--text-muted)',
            border: `1px solid ${undoTreeOpen ? 'var(--accent-magenta)' : 'transparent'}`,
          }}
          onClick={() => setUndoTreeOpen(!undoTreeOpen)}
          title="Toggle Undo History"
        >
          <History size={10} /> UNDO
        </button>

        {/* Export */}
        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded"
          style={{
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid transparent',
          }}
          onClick={() => store.setShowExport(true)}
          title="Export (Ctrl+E)"
        >
          <Download size={10} /> EXPORT
        </button>

        {/* New project */}
        <button
          className="flex items-center gap-1 text-[10px] px-2 h-5 rounded hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => {
            if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;
            store.newProject();
          }}
          title="New project"
        >
          <FileText size={10} /> NEW
        </button>
      </div>

      {/* Transport */}
      <TransportBar />

      {/* Main area: left library + right content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left library panel */}
        <div
          className="flex flex-col shrink-0 border-r overflow-hidden transition-all duration-200"
          style={{
            width: libCollapsed ? 28 : 'min(280px, 40vw)',
            borderColor: 'var(--border)',
            background: 'var(--bg-surface)',
          }}
        >
          {libCollapsed ? (
            <button
              className="flex items-center justify-center w-full h-full"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setLibCollapsed(false)}
              title="Expand library"
            >
              <ChevronRight size={14} />
            </button>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex items-center border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                {(['tracks', 'samples'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setLibTab(tab)}
                    className="flex-1 h-7 text-[9px] uppercase tracking-wider font-bold transition-all"
                    style={{
                      fontFamily: 'var(--font-orbitron)',
                      borderBottom: libTab === tab ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                      color: libTab === tab ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    }}
                  >
                    {tab}
                  </button>
                ))}
                <button
                  className="w-6 h-7 flex items-center justify-center shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setLibCollapsed(true)}
                  title="Collapse library"
                >
                  <ChevronLeft size={12} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {libTab === 'tracks' ? (
                  <TrackLibrary />
                ) : (
                  <SampleBrowser dawMode />
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: main view + bottom panels */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Main view — shrinks when bottom panels open */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {view === 'arrangement' ? <ArrangementView /> : <ClipLauncher />}
          </div>

          {/* Drum Machine (collapsible bottom panel) */}
          {/* Channel Rack (collapsible bottom panel) */}
          {channelRackOpen && (
            <div className="shrink-0 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              <ChannelRack />
            </div>
          )}

          {drumOpen && (
            <div className="shrink-0 border-t overflow-y-auto" style={{ borderColor: 'var(--border)', maxHeight: '40vh' }}>
              <DrumMachine dawMode />
            </div>
          )}

          {/* Piano Roll (collapsible bottom panel) */}
          {pianoRollOpen && (
            <div className="shrink-0 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              <PianoRoll />
            </div>
          )}

          {/* Mixer (collapsible bottom panel) */}
          {mixerOpen && (
            <div className="shrink-0 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              <DAWMixer />
            </div>
          )}
        </div>
      </div>

      {/* Export modal */}
      {showExportModal && <ExportModal />}

      {/* Floating Windows */}
      {patcherOpen && (
        <FloatingWindow title="Patcher" icon={<Network size={14} />} onClose={() => setPatcherOpen(false)} initialW={800} initialH={500} initialX={100} initialY={100}>
          <Patcher />
        </FloatingWindow>
      )}
      {scoreLogOpen && <ScoreLog onClose={() => setScoreLogOpen(false)} />}
      {undoTreeOpen && <UndoTree onClose={() => setUndoTreeOpen(false)} />}
    </div>
  );
}
