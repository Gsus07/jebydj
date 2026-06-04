'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectStore } from '@/src/store/useProjectStore';
import { ProjectManager } from '@/src/lib/storage/ProjectManager';
import type { ProjectMeta } from '@/src/store/projectTypes';
import {
  Plus, Upload, X, MoreHorizontal,
  Trash2, Download, Copy, Pencil,
  Clock, Music2, Layers, FolderOpen,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Hace un momento';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Hace ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `Hace ${months} mes${months > 1 ? 'es' : ''}`;
}

// ─── Project Card ────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onOpen,
  onExport,
  onDuplicate,
  onDelete,
}: {
  project: ProjectMeta;
  onOpen: () => void;
  onExport: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      className="relative group rounded-xl overflow-hidden cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, rgba(20,20,35,0.95), rgba(15,15,28,0.95))',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
      whileHover={{ y: -4, boxShadow: '0 8px 30px rgba(0,245,255,0.08)' }}
      transition={{ duration: 0.2 }}
      onClick={onOpen}
      layout
    >
      {/* Top accent bar */}
      <div
        className="h-1 w-full"
        style={{
          background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-magenta))',
        }}
      />

      <div className="p-4">
        {/* Waveform placeholder */}
        <div
          className="h-10 rounded-lg mb-3 flex items-center justify-center overflow-hidden"
          style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.08)' }}
        >
          <div className="flex items-end gap-px h-6 w-full px-2">
            {Array.from({ length: 40 }, (_, i) => {
              const h = Math.sin(i * 0.4) * 0.4 + Math.random() * 0.3 + 0.3;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full"
                  style={{
                    height: `${h * 100}%`,
                    background: `rgba(0,245,255,${0.3 + h * 0.5})`,
                    minWidth: 1,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Name */}
        <h3
          className="text-sm font-rajdhani font-bold mb-1 truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {project.name}
        </h3>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-[10px] font-rajdhani" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-0.5">
            <Music2 size={9} />
            {project.bpm} BPM
          </span>
          <span className="flex items-center gap-0.5">
            <Layers size={9} />
            {project.trackCount} tracks
          </span>
        </div>

        <div className="flex items-center gap-1 mt-1.5 text-[9px] font-rajdhani" style={{ color: 'var(--text-muted)' }}>
          <Clock size={8} />
          {timeAgo(project.updatedAt)}
        </div>
      </div>

      {/* Menu button */}
      <button
        className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
        style={{ color: 'var(--text-muted)' }}
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreHorizontal size={14} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="absolute top-10 right-3 rounded-lg py-1 z-50 min-w-[140px]"
            style={{
              background: 'rgba(20,20,35,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-rajdhani hover:bg-white/5 text-left"
              style={{ color: 'var(--text-primary)' }}
              onClick={() => { setShowMenu(false); onExport(); }}
            >
              <Download size={12} /> Exportar
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-rajdhani hover:bg-white/5 text-left"
              style={{ color: 'var(--text-primary)' }}
              onClick={() => { setShowMenu(false); onDuplicate(); }}
            >
              <Copy size={12} /> Duplicar
            </button>
            <div className="h-px mx-2 my-1" style={{ background: 'var(--border)' }} />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-rajdhani hover:bg-red-500/10 text-left"
              style={{ color: '#ff6666' }}
              onClick={() => { setShowMenu(false); onDelete(); }}
            >
              <Trash2 size={12} /> Eliminar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES = [
  { name: 'DJ Set', bpm: 128, icon: '🎧', color: '#00f5ff' },
  { name: 'Podcast', bpm: 60, icon: '🎙️', color: '#06d6a0' },
  { name: 'Beat', bpm: 140, icon: '🥁', color: '#ff006e' },
  { name: 'Vacío', bpm: 120, icon: '📄', color: '#8338ec' },
];

// ─── ProjectBrowser ──────────────────────────────────────────────────────────

export function ProjectBrowser() {
  const {
    showBrowser, setShowBrowser, recentProjects,
    isLoading, loadingProgress,
  } = useProjectStore();

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Refresh list when opened
  useEffect(() => {
    if (showBrowser) {
      void ProjectManager.refreshProjectList();
    }
  }, [showBrowser]);

  const handleNewProject = useCallback(() => {
    const { useDAWStore } = require('@/src/store/useDAWStore');
    useDAWStore.getState().newProject();
    useProjectStore.getState().setCurrentProject(null, 'Proyecto sin título');
    useProjectStore.getState().setSaved(true);
    setShowBrowser(false);
  }, [setShowBrowser]);

  const handleOpen = useCallback(async (id: string) => {
    try {
      await ProjectManager.load(id);
      setShowBrowser(false);
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  }, [setShowBrowser]);

  const handleExport = useCallback(async (id: string) => {
    try {
      await ProjectManager.exportToFile(id);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

  const handleDuplicate = useCallback(async (project: ProjectMeta) => {
    try {
      const { dbLoadProject } = await import('@/src/lib/storage/ProjectDatabase');
      const full = await dbLoadProject(project.id);
      if (!full) return;
      full.id = crypto.randomUUID();
      full.name = project.name + ' (copia)';
      full.updatedAt = Date.now();
      const { dbSaveProject } = await import('@/src/lib/storage/ProjectDatabase');
      await dbSaveProject(full);
      await ProjectManager.refreshProjectList();
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await ProjectManager.delete(id);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, []);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jbproject';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const id = await ProjectManager.importFromFile(file);
        await ProjectManager.load(id);
        setShowBrowser(false);
      } catch (err) {
        console.error('Import failed:', err);
        alert('Error al importar el proyecto. El archivo puede estar dañado.');
      }
    };
    input.click();
  }, [setShowBrowser]);

  const handleTemplate = useCallback((bpm: number) => {
    const { useDAWStore } = require('@/src/store/useDAWStore');
    useDAWStore.getState().newProject();
    useDAWStore.getState().setBpm(bpm);
    useProjectStore.getState().setCurrentProject(null, 'Proyecto sin título');
    useProjectStore.getState().setSaved(true);
    setShowBrowser(false);
  }, [setShowBrowser]);

  return (
    <AnimatePresence>
      {showBrowser && (
        <motion.div
          className="fixed inset-0 z-[9998] flex items-center justify-center overflow-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            className="w-full max-w-3xl mx-4 my-8 rounded-2xl overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            style={{
              background: 'linear-gradient(180deg, rgba(18,18,30,0.98), rgba(10,10,20,0.98))',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 60px rgba(0,245,255,0.03)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="font-orbitron font-black text-sm" style={{ color: '#00f5ff' }}>JEBY</span>
                <span className="font-orbitron font-black text-sm" style={{ color: '#ff006e' }}>DJ</span>
                <span className="text-xs font-rajdhani" style={{ color: 'var(--text-muted)' }}>— Proyectos</span>
              </div>
              <button
                onClick={() => setShowBrowser(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Loading overlay */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-magenta))' }}
                      animate={{ width: `${loadingProgress * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-rajdhani" style={{ color: 'var(--text-muted)' }}>
                    Cargando proyecto... {Math.round(loadingProgress * 100)}%
                  </span>
                </div>
              )}

              {!isLoading && (
                <>
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    <button
                      onClick={handleNewProject}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-rajdhani font-semibold transition-all hover:brightness-110"
                      style={{
                        background: 'var(--accent-cyan)',
                        color: '#000',
                        boxShadow: '0 0 12px rgba(0,245,255,0.2)',
                      }}
                    >
                      <Plus size={14} /> NUEVO PROYECTO
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-rajdhani font-semibold transition-all hover:bg-white/10"
                      style={{
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <Upload size={14} /> IMPORTAR .jbproject
                    </button>
                  </div>

                  {/* Recent Projects */}
                  {recentProjects.length > 0 && (
                    <div className="mb-6">
                      <h3
                        className="text-[10px] font-rajdhani uppercase tracking-widest mb-3"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Proyectos recientes
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {recentProjects.map((p) => (
                          <ProjectCard
                            key={p.id}
                            project={p}
                            onOpen={() => handleOpen(p.id)}
                            onExport={() => handleExport(p.id)}
                            onDuplicate={() => handleDuplicate(p)}
                            onDelete={() => setConfirmDelete(p.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {recentProjects.length === 0 && (
                    <div className="text-center py-12">
                      <FolderOpen size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm font-rajdhani" style={{ color: 'var(--text-muted)' }}>
                        No tienes proyectos guardados aún.
                      </p>
                      <p className="text-xs font-rajdhani mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                        Crea uno nuevo o importa un archivo .jbproject
                      </p>
                    </div>
                  )}

                  {/* Templates */}
                  <div>
                    <h3
                      className="text-[10px] font-rajdhani uppercase tracking-widest mb-3"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Templates
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATES.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => handleTemplate(t.bpm)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-rajdhani transition-all hover:brightness-110"
                          style={{
                            background: `${t.color}15`,
                            color: t.color,
                            border: `1px solid ${t.color}30`,
                          }}
                        >
                          <span className="text-sm">{t.icon}</span>
                          {t.name}
                          <span className="text-[9px] opacity-60">{t.bpm} BPM</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Delete confirmation */}
            <AnimatePresence>
              {confirmDelete && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ background: 'rgba(0,0,0,0.7)' }}
                  onClick={() => setConfirmDelete(null)}
                >
                  <motion.div
                    className="rounded-xl p-5 mx-4 max-w-xs"
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    style={{
                      background: 'rgba(30,15,15,0.98)',
                      border: '1px solid rgba(255,68,68,0.3)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-sm font-rajdhani mb-4" style={{ color: 'var(--text-primary)' }}>
                      ¿Eliminar este proyecto permanentemente?
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 text-xs rounded-lg font-rajdhani"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDelete(confirmDelete)}
                        className="px-3 py-1.5 text-xs rounded-lg font-rajdhani font-semibold"
                        style={{ background: '#ff4444', color: '#fff' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
