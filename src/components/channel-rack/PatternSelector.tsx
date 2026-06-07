'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChannelRackStore } from '@/src/store/useChannelRackStore';
import { Plus, MoreHorizontal, Copy, Trash2, ChevronDown } from 'lucide-react';

export function PatternSelector() {
  const {
    patterns, activePatternId, setActivePattern,
    addPattern, removePattern, duplicatePattern, renamePattern,
  } = useChannelRackStore();

  const [open, setOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = patterns.find((p) => p.id === activePatternId);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input on edit
  useEffect(() => {
    if (editingId) setTimeout(() => inputRef.current?.select(), 10);
  }, [editingId]);

  const commitRename = () => {
    if (editingId && editName.trim()) {
      renamePattern(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      {/* Active pattern button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-rajdhani font-semibold transition-colors hover:bg-white/5"
        style={{ color: active?.color ?? 'var(--text-primary)' }}
      >
        <div className="w-2 h-2 rounded-sm" style={{ background: active?.color ?? '#555' }} />
        {active?.name ?? 'Pattern'}
        <ChevronDown size={10} className="opacity-50" />
      </button>

      {/* Add pattern */}
      <button
        onClick={() => addPattern()}
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
        style={{ color: 'var(--text-muted)' }}
        title="New pattern"
      >
        <Plus size={11} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg py-1 min-w-[180px] max-h-[300px] overflow-y-auto"
          style={{
            background: 'rgba(18,18,30,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          }}
        >
          {patterns.map((pat) => (
            <div
              key={pat.id}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-rajdhani cursor-pointer hover:bg-white/5 group"
              style={{
                color: pat.id === activePatternId ? pat.color : 'var(--text-primary)',
                background: pat.id === activePatternId ? `${pat.color}15` : undefined,
              }}
              onClick={() => {
                setActivePattern(pat.id);
                setOpen(false);
              }}
            >
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: pat.color }} />

              {editingId === pat.id ? (
                <input
                  ref={inputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="flex-1 text-xs bg-transparent outline-none px-1 rounded"
                  style={{ color: 'var(--text-primary)', border: '1px solid var(--accent-cyan)' }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="flex-1 truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingId(pat.id);
                    setEditName(pat.name);
                  }}
                >
                  {pat.name}
                </span>
              )}

              {/* Context menu button */}
              <button
                className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuId(menuId === pat.id ? null : pat.id);
                }}
              >
                <MoreHorizontal size={10} />
              </button>

              {/* Context menu */}
              {menuId === pat.id && (
                <div
                  className="absolute right-2 top-full z-50 rounded-lg py-1 min-w-[120px]"
                  style={{
                    background: 'rgba(25,25,40,0.98)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1 text-xs font-rajdhani hover:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                    onClick={() => { duplicatePattern(pat.id); setMenuId(null); }}
                  >
                    <Copy size={10} /> Duplicar
                  </button>
                  {patterns.length > 1 && (
                    <button
                      className="flex items-center gap-2 w-full px-3 py-1 text-xs font-rajdhani hover:bg-red-500/10"
                      style={{ color: '#ff6666' }}
                      onClick={() => { removePattern(pat.id); setMenuId(null); }}
                    >
                      <Trash2 size={10} /> Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
