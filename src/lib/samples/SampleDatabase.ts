// ─── SampleDatabase — IndexedDB persistence ───────────────────────────────────
// Uses idb-keyval with namespace prefixes.

import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, createStore } from 'idb-keyval';
import type { SampleItem, SamplePack } from '@/src/store/sampleTypes';

const sampleStore = createStore('jebydj-samples', 'samples');
const packStore   = createStore('jebydj-samples', 'packs');
const bufferStore = createStore('jebydj-samples', 'buffers'); // raw ArrayBuffer

// ─── Samples ─────────────────────────────────────────────────────────────────

export async function dbSaveSample(item: SampleItem): Promise<void> {
  await idbSet(item.id, item, sampleStore);
}

export async function dbSaveSamples(items: SampleItem[]): Promise<void> {
  await Promise.all(items.map((s) => idbSet(s.id, s, sampleStore)));
}

export async function dbLoadAllSamples(): Promise<SampleItem[]> {
  const allKeys = await idbKeys<string>(sampleStore);
  const results = await Promise.all(allKeys.map((k) => idbGet<SampleItem>(k, sampleStore)));
  return results.filter((x): x is SampleItem => x !== undefined);
}

export async function dbDeleteSample(id: string): Promise<void> {
  await idbDel(id, sampleStore);
  await idbDel(id, bufferStore);
}

export async function dbUpdateSample(id: string, patch: Partial<SampleItem>): Promise<void> {
  const existing = await idbGet<SampleItem>(id, sampleStore);
  if (existing) await idbSet(id, { ...existing, ...patch }, sampleStore);
}

// ─── Packs ────────────────────────────────────────────────────────────────────

export async function dbSavePack(pack: SamplePack): Promise<void> {
  await idbSet(pack.id, pack, packStore);
}

export async function dbLoadAllPacks(): Promise<SamplePack[]> {
  const allKeys = await idbKeys<string>(packStore);
  const results = await Promise.all(allKeys.map((k) => idbGet<SamplePack>(k, packStore)));
  return results.filter((x): x is SamplePack => x !== undefined);
}

export async function dbDeletePack(id: string): Promise<void> {
  await idbDel(id, packStore);
}

// ─── Audio buffers (raw ArrayBuffer for large files) ─────────────────────────

export async function dbSaveBuffer(id: string, buffer: ArrayBuffer): Promise<void> {
  await idbSet(id, buffer, bufferStore);
}

export async function dbLoadBuffer(id: string): Promise<ArrayBuffer | undefined> {
  return idbGet<ArrayBuffer>(id, bufferStore);
}

export async function dbDeleteBuffer(id: string): Promise<void> {
  await idbDel(id, bufferStore);
}

// ─── Utility: check if builtin pack was already generated ────────────────────

const FLAG_KEY = 'builtin-generated-v1';
const flagStore = createStore('jebydj-samples', 'flags');

export async function isBuiltinGenerated(): Promise<boolean> {
  return !!(await idbGet<boolean>(FLAG_KEY, flagStore));
}

export async function markBuiltinGenerated(): Promise<void> {
  await idbSet(FLAG_KEY, true, flagStore);
}
