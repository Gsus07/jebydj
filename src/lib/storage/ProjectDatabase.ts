// ─── ProjectDatabase — IndexedDB persistence for projects & audio files ──────
// Uses idb-keyval with separate databases (one per store) to avoid version conflicts.

import {
  get as idbGet, set as idbSet, del as idbDel,
  keys as idbKeys, getMany as idbGetMany,
  createStore,
} from 'idb-keyval';
import type { SavedProject, ProjectMeta } from '@/src/store/projectTypes';

// ─── Stores ──────────────────────────────────────────────────────────────────

const projectStore = createStore('jebydj-projects-db', 'projects');
const audioFileStore = createStore('jebydj-project-audio-db', 'audioFiles');

// ─── Projects ────────────────────────────────────────────────────────────────

export async function dbSaveProject(project: SavedProject): Promise<void> {
  await idbSet(project.id, project, projectStore);
}

export async function dbLoadProject(id: string): Promise<SavedProject | null> {
  const result = await idbGet<SavedProject>(id, projectStore);
  return result ?? null;
}

export async function dbDeleteProject(id: string): Promise<void> {
  await idbDel(id, projectStore);
}

export async function dbListProjects(): Promise<ProjectMeta[]> {
  const allKeys = await idbKeys<string>(projectStore);
  if (allKeys.length === 0) return [];

  const projects = await idbGetMany<SavedProject>(allKeys, projectStore);
  return projects
    .filter((p): p is SavedProject => p !== undefined)
    .map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      bpm: p.daw.bpm,
      trackCount: p.daw.tracks.length,
      clipCount: p.daw.tracks.reduce((sum, t) => sum + t.clips.length, 0),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt); // most recent first
}

// ─── Audio Files ─────────────────────────────────────────────────────────────

interface StoredAudioFile {
  arrayBuffer: ArrayBuffer;
  name: string;
  size: number;
  storedAt: number;
}

export async function dbSaveAudioFile(
  hash: string,
  data: { arrayBuffer: ArrayBuffer; name: string; size: number },
): Promise<void> {
  // Don't overwrite if it already exists (same content hash)
  const existing = await idbGet<StoredAudioFile>(hash, audioFileStore);
  if (existing) return;

  const record: StoredAudioFile = {
    arrayBuffer: data.arrayBuffer,
    name: data.name,
    size: data.size,
    storedAt: Date.now(),
  };
  await idbSet(hash, record, audioFileStore);
}

export async function dbLoadAudioFile(hash: string): Promise<ArrayBuffer | null> {
  const record = await idbGet<StoredAudioFile>(hash, audioFileStore);
  return record?.arrayBuffer ?? null;
}

export async function dbDeleteAudioFile(hash: string): Promise<void> {
  await idbDel(hash, audioFileStore);
}

export async function dbListAudioFileKeys(): Promise<string[]> {
  return idbKeys<string>(audioFileStore);
}

// ─── Storage Estimate ────────────────────────────────────────────────────────

export async function getStorageEstimate(): Promise<{ used: number; quota: number }> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const est = await navigator.storage.estimate();
    return { used: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return { used: 0, quota: 0 };
}
