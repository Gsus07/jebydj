// ─── PackImporter — import ZIP packs, folders, and individual files ───────────

import type { SampleItem, SampleCategory } from '@/src/store/sampleTypes';
import { hashArrayBuffer } from './SampleManager';
import { dbSaveBuffer, dbSaveSample, dbSavePack } from './SampleDatabase';
import type { SamplePack } from '@/src/store/sampleTypes';

const AUDIO_EXTS = new Set(['.wav', '.mp3', '.flac', '.ogg', '.aiff', '.aif', '.m4a', '.opus']);

function ext(name: string): string {
  return name.toLowerCase().slice(name.lastIndexOf('.'));
}

function inferCategory(filePath: string): SampleCategory {
  const p = filePath.toLowerCase();
  if (/kick|bd\b|bass.?drum/.test(p)) return 'kicks';
  if (/snare|sd\b/.test(p)) return 'snares';
  if (/clap/.test(p)) return 'snares';
  if (/hat|hh\b|hihat/.test(p)) return 'hihat';
  if (/cymbal|crash|ride|bell/.test(p)) return 'cymbals';
  if (/tom/.test(p)) return 'toms';
  if (/conga|bongo|shaker|tamb|wood|perc/.test(p)) return 'percussion';
  if (/drum.?loop|loop.*drum/.test(p)) return 'drum-loops';
  if (/808|sub.?bass|bass.?drop/.test(p)) return '808s';
  if (/bass.?loop/.test(p)) return 'bass-loops';
  if (/drop|impact|hit/.test(p)) return 'drops';
  if (/rise|build|riser/.test(p)) return 'rises';
  if (/down.?lift|down.?filter/.test(p)) return 'downlifters';
  if (/sweep|whoosh/.test(p)) return 'sweeps';
  if (/vinyl|scratch/.test(p)) return 'vinyl';
  if (/crowd|cheer|applause/.test(p)) return 'crowd';
  if (/noise|white|pink/.test(p)) return 'noise';
  if (/chord.?loop|loop.*chord/.test(p)) return 'chord-loops';
  if (/melody|mel.?loop|loop.*mel/.test(p)) return 'melody-loops';
  if (/vocal|vox|chop/.test(p)) return 'vocal-chops';
  if (/piano/.test(p)) return 'piano-shots';
  if (/synth/.test(p)) return 'synth-shots';
  if (/string|violin|cello/.test(p)) return 'strings-shots';
  return 'user';
}

function inferType(filePath: string, duration: number): SampleItem['type'] {
  const p = filePath.toLowerCase();
  if (/loop|lp\b/.test(p) || (duration > 1 && duration < 30)) return 'loop';
  if (/fx|riser|rise|drop|sweep|whoosh|vinyl|noise|impact/.test(p)) return 'fx';
  return 'one-shot';
}

function extractTags(name: string): string[] {
  return name
    .replace(/\.[^.]+$/, '')
    .split(/[\s_\-()[\]{}]+/)
    .filter((t) => t.length >= 2)
    .map((t) => t.toLowerCase());
}

function extractBpmFromName(name: string): number | undefined {
  const m = name.match(/(\d{2,3})[\s_]?bpm/i) ?? name.match(/bpm[\s_]?(\d{2,3})/i);
  if (m) { const v = parseInt(m[1]); if (v >= 60 && v <= 220) return v; }
  return undefined;
}

function extractKeyFromName(name: string): string | undefined {
  const m = name.match(/\b([A-G][#b]?)\s*(maj|min|m)?\b/i);
  return m ? m[0].trim() : undefined;
}

function uid(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ─── Decode + build SampleItem ────────────────────────────────────────────────

async function processAudioData(
  raw: ArrayBuffer,
  fileName: string,
  filePath: string,
  packId: string,
): Promise<SampleItem | null> {
  try {
    const id = await hashArrayBuffer(raw);
    const ctx = new OfflineAudioContext(1, 1, 44100);
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(raw.slice(0));
    } catch {
      return null; // unsupported format
    }

    const duration = buffer.duration;
    const ch = buffer.getChannelData(0);
    const POINTS = 200;
    const block = Math.max(1, Math.floor(ch.length / POINTS));
    const waveformData: number[] = [];
    let peak = 0; let sumSq = 0;
    for (let i = 0; i < POINTS; i++) {
      let mx = 0;
      for (let j = 0; j < block; j++) {
        const v = Math.abs(ch[i * block + j] ?? 0);
        if (v > mx) mx = v;
      }
      waveformData.push(mx);
      if (mx > peak) peak = mx;
      sumSq += mx * mx;
    }
    const rms = Math.sqrt(sumSq / POINTS);

    // Persist
    const { sampleManager } = await import('./SampleManager');
    sampleManager.storeBuffer(id, buffer);
    if (raw.byteLength < 10 * 1024 * 1024) {
      await dbSaveBuffer(id, raw);
    }

    const bpm = extractBpmFromName(fileName);
    const key = extractKeyFromName(fileName);
    const category = inferCategory(filePath);
    const type = inferType(filePath, duration);
    const tags = extractTags(fileName);

    const item: SampleItem = {
      id, name: fileName.replace(/\.[^.]+$/, ''),
      packId, category, type, duration,
      bpm, key, tags,
      isFavorite: false, rating: 0, usageCount: 0,
      waveformData, rms, peak,
      notes: '', colorLabel: 0, createdAt: Date.now(),
    };

    await dbSaveSample(item);
    return item;
  } catch {
    return null;
  }
}

// ─── Import individual files ─────────────────────────────────────────────────

export async function importFiles(
  files: File[],
  packId: string,
  onProgress?: (cur: number, total: number) => void,
): Promise<SampleItem[]> {
  const audioFiles = files.filter((f) => AUDIO_EXTS.has(ext(f.name)));
  const items: SampleItem[] = [];
  for (let i = 0; i < audioFiles.length; i++) {
    onProgress?.(i, audioFiles.length);
    const f = audioFiles[i];
    const raw = await f.arrayBuffer();
    const item = await processAudioData(raw, f.name, f.name, packId);
    if (item) items.push(item);
  }
  return items;
}

// ─── Import ZIP pack ─────────────────────────────────────────────────────────

export async function importZip(
  file: File,
  onProgress?: (cur: number, total: number) => void,
): Promise<{ pack: SamplePack; samples: SampleItem[] }> {
  const { unzip } = await import('fflate');
  const rawZip = await file.arrayBuffer();
  const packId = uid();
  const packName = file.name.replace(/\.zip$/i, '');

  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(new Uint8Array(rawZip), (err, data) => err ? reject(err) : resolve(data));
  });

  const audioEntries = Object.entries(entries).filter(([path]) => AUDIO_EXTS.has(ext(path)));
  const items: SampleItem[] = [];

  for (let i = 0; i < audioEntries.length; i++) {
    onProgress?.(i, audioEntries.length);
    const [path, data] = audioEntries[i];
    const fileName = path.split('/').pop() ?? path;
    const raw = (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
    const item = await processAudioData(raw, fileName, path, packId);
    if (item) items.push(item);
  }

  const pack: SamplePack = {
    id: packId, name: packName, description: `Imported from ${file.name}`,
    color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
    isBuiltin: false, sampleCount: items.length,
    importedAt: Date.now(),
  };
  await dbSavePack(pack);
  return { pack, samples: items };
}

// ─── Import folder (File System Access API) ──────────────────────────────────

async function collectFilesFromEntry(
  entry: FileSystemDirectoryEntry,
  results: File[] = [],
): Promise<File[]> {
  const reader = entry.createReader();
  const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
  for (const e of entries) {
    if (e.isFile) {
      const fe = e as FileSystemFileEntry;
      const f = await new Promise<File>((res, rej) => fe.file(res, rej));
      if (AUDIO_EXTS.has(ext(f.name))) results.push(f);
    } else if (e.isDirectory) {
      await collectFilesFromEntry(e as FileSystemDirectoryEntry, results);
    }
  }
  return results;
}

export async function importDroppedItems(
  dataTransferItems: DataTransferItemList,
  onProgress?: (cur: number, total: number) => void,
): Promise<{ pack: SamplePack; samples: SampleItem[] } | null> {
  const files: File[] = [];
  let packName = 'Dropped Pack';

  for (let i = 0; i < dataTransferItems.length; i++) {
    const item = dataTransferItems[i];
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry?.isDirectory) {
      packName = entry.name;
      await collectFilesFromEntry(entry as FileSystemDirectoryEntry, files);
    } else if (entry?.isFile) {
      const fe = entry as FileSystemFileEntry;
      const f = await new Promise<File>((res, rej) => fe.file(res, rej));
      if (ext(f.name) === '.zip') {
        return importZip(f, onProgress);
      }
      if (AUDIO_EXTS.has(ext(f.name))) files.push(f);
    }
  }

  if (files.length === 0) return null;

  const packId = uid();
  const items = await importFiles(files, packId, onProgress);
  const pack: SamplePack = {
    id: packId, name: packName, description: `${files.length} files imported`,
    color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
    isBuiltin: false, sampleCount: items.length, importedAt: Date.now(),
  };
  await dbSavePack(pack);
  return { pack, samples: items };
}
