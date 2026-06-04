'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/src/store/useProjectStore';
import { ProjectManager } from '@/src/lib/storage/ProjectManager';
import { Save, FolderOpen, ChevronDown } from 'lucide-react';

export function ProjectIndicator() {
  const {
    currentProjectName, isSaved, isSaving, saveError,
    setShowBrowser, setShowSaveAs, currentProjectId,
  } = useProjectStore();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const handleNameClick = useCallback(() => {
    setEditingName(true);
    setNameInput(currentProjectName);
    setTimeout(() => nameRef.current?.select(), 10);
  }, [currentProjectName]);

  const commitName = useCallback(async () => {
    setEditingName(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== currentProjectName) {
      useProjectStore.getState().setCurrentProject(
        currentProjectId,
        trimmed,
      );
      useProjectStore.getState().markUnsaved();
    }
  }, [nameInput, currentProjectName, currentProjectId]);

  const handleSave = useCallback(async () => {
    if (!currentProjectId) {
      // First save → show "Save As" modal
      setShowSaveAs(true);
    } else {
      try {
        await ProjectManager.save();
      } catch (err) {
        console.error('Save failed:', err);
      }
    }
  }, [currentProjectId, setShowSaveAs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl+S → save
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+Shift+S → save as
      if (e.key === 'S' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        setShowSaveAs(true);
      }
      // Ctrl+O → open project browser
      if (e.key === 'o' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowBrowser(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, setShowSaveAs, setShowBrowser]);

  // Status dot color
  const dotColor = saveError
    ? '#ff4444'
    : isSaving
    ? '#06d6a0'
    : isSaved
    ? '#555566'
    : '#ffbe0b';

  const dotTitle = saveError
    ? `Error: ${saveError}`
    : isSaving
    ? 'Guardando...'
    : isSaved
    ? 'Guardado'
    : 'Cambios sin guardar';

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {/* Project Browser button */}
      <button
        onClick={() => setShowBrowser(true)}
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 transition-colors"
        title="Proyectos (Ctrl+O)"
        style={{ color: 'var(--text-muted)' }}
      >
        <FolderOpen size={13} />
      </button>

      {/* Project name */}
      {editingName ? (
        <input
          ref={nameRef}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') setEditingName(false);
          }}
          className="w-28 text-xs rounded px-1.5 py-0.5 outline-none font-rajdhani"
          style={{
            background: 'var(--bg-card)',
            color: 'var(--accent-cyan)',
            border: '1px solid var(--accent-cyan)',
          }}
        />
      ) : (
        <button
          onClick={handleNameClick}
          className="flex items-center gap-0.5 text-xs font-rajdhani px-1.5 py-0.5 rounded hover:bg-white/5 truncate max-w-[120px]"
          style={{ color: 'var(--text-primary)' }}
          title="Click para renombrar"
        >
          <span className="truncate">{currentProjectName}</span>
          <ChevronDown size={10} className="opacity-40 flex-shrink-0" />
        </button>
      )}

      {/* Status dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300"
        style={{
          backgroundColor: dotColor,
          boxShadow: isSaving ? `0 0 6px ${dotColor}` : 'none',
        }}
        title={dotTitle}
      />

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
        title="Guardar (Ctrl+S)"
        style={{ color: isSaved ? 'var(--text-muted)' : 'var(--accent-amber)' }}
      >
        <Save size={13} />
      </button>
    </div>
  );
}
