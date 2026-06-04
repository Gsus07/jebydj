'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectStore } from '@/src/store/useProjectStore';
import { ProjectManager } from '@/src/lib/storage/ProjectManager';
import { Save, X } from 'lucide-react';

export function SaveAsModal() {
  const { showSaveAs, setShowSaveAs, currentProjectName } = useProjectStore();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSaveAs) {
      setName(currentProjectName || 'Proyecto sin título');
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [showSaveAs, currentProjectName]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setShowSaveAs(false);
    try {
      await ProjectManager.save(trimmed);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <AnimatePresence>
      {showSaveAs && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowSaveAs(false)}
        >
          <motion.div
            className="w-full max-w-sm rounded-xl p-6 mx-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            style={{
              background: 'linear-gradient(135deg, rgba(18,18,30,0.98), rgba(12,12,22,0.98))',
              border: '1px solid rgba(0,245,255,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,245,255,0.05)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-base font-rajdhani font-bold tracking-wide"
                style={{ color: 'var(--text-primary)' }}
              >
                Guardar proyecto
              </h2>
              <button
                onClick={() => setShowSaveAs(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Input */}
            <label className="block mb-4">
              <span className="text-[10px] font-rajdhani uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                Nombre
              </span>
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none font-rajdhani transition-colors"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                placeholder="Mi proyecto increíble..."
                autoFocus
              />
            </label>

            {/* Buttons */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveAs(false)}
                className="px-4 py-2 text-xs rounded-lg font-rajdhani font-semibold transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-rajdhani font-semibold transition-all hover:brightness-110 disabled:opacity-40"
                style={{
                  background: 'var(--accent-cyan)',
                  color: '#000',
                  boxShadow: '0 0 12px rgba(0,245,255,0.3)',
                }}
              >
                <Save size={12} />
                Guardar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
