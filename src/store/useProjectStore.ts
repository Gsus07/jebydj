'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ProjectMeta } from './projectTypes';

// ─── Project UI Store ────────────────────────────────────────────────────────

interface ProjectStoreState {
  currentProjectId: string | null;
  currentProjectName: string;
  isSaved: boolean;
  isSaving: boolean;
  saveError: string | null;
  isLoading: boolean;
  loadingProgress: number;   // 0-1
  showBrowser: boolean;
  showSaveAs: boolean;
  recentProjects: ProjectMeta[];
}

interface ProjectStoreActions {
  setCurrentProject: (id: string | null, name: string) => void;
  setSaved: (v: boolean) => void;
  setSaving: (v: boolean) => void;
  setSaveError: (err: string | null) => void;
  setLoading: (v: boolean) => void;
  setLoadingProgress: (v: number) => void;
  setShowBrowser: (v: boolean) => void;
  setShowSaveAs: (v: boolean) => void;
  setRecentProjects: (list: ProjectMeta[]) => void;
  markUnsaved: () => void;
}

type ProjectStore = ProjectStoreState & ProjectStoreActions;

export const useProjectStore = create<ProjectStore>()(
  immer((set) => ({
    currentProjectId: null,
    currentProjectName: 'Proyecto sin título',
    isSaved: true,
    isSaving: false,
    saveError: null,
    isLoading: false,
    loadingProgress: 0,
    showBrowser: false,
    showSaveAs: false,
    recentProjects: [],

    setCurrentProject: (id, name) => set((s) => {
      s.currentProjectId = id;
      s.currentProjectName = name;
    }),
    setSaved: (v) => set((s) => { s.isSaved = v; s.saveError = null; }),
    setSaving: (v) => set((s) => { s.isSaving = v; }),
    setSaveError: (err) => set((s) => { s.saveError = err; s.isSaving = false; }),
    setLoading: (v) => set((s) => { s.isLoading = v; }),
    setLoadingProgress: (v) => set((s) => { s.loadingProgress = v; }),
    setShowBrowser: (v) => set((s) => { s.showBrowser = v; }),
    setShowSaveAs: (v) => set((s) => { s.showSaveAs = v; }),
    setRecentProjects: (list) => set((s) => { s.recentProjects = list; }),
    markUnsaved: () => set((s) => { s.isSaved = false; }),
  })),
);
