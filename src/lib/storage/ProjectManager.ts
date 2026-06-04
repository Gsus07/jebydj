// ─── ProjectManager — Orchestrates save/load/export/import ───────────────────

import { useDJStore } from '@/src/store/useDJStore';
import { useDAWStore } from '@/src/store/useDAWStore';
import { useSampleStore } from '@/src/store/useSampleStore';
import { useProjectStore } from '@/src/store/useProjectStore';
import {
  dbSaveProject, dbLoadProject, dbDeleteProject, dbListProjects,
  dbSaveAudioFile, dbLoadAudioFile, dbListAudioFileKeys, dbDeleteAudioFile,
} from './ProjectDatabase';
import { storeAudioBuffer, getAudioBuffer } from '@/src/lib/daw/DAWEngine';
import { audioEngine } from '@/src/lib/audio/AudioEngine';
import type {
  SavedProject, SerializedDeck, SerializedSampler,
  SerializedSamplerPad, AudioFileRef,
} from '@/src/store/projectTypes';
import type { DeckState, SamplerPad } from '@/src/store/types';
import type { DAWProject } from '@/src/store/dawTypes';

const APP_VERSION = '1.0.0';

// ─── Hash helper ─────────────────────────────────────────────────────────────

async function hashArrayBuffer(buf: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const arr = new Uint8Array(hashBuf);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Serialization Helpers ───────────────────────────────────────────────────

function serializeDeck(deck: DeckState): SerializedDeck {
  return {
    trackFileHash: null, // Will be set by the caller if audio is loaded
    trackName: deck.trackName,
    artistName: deck.artistName,
    duration: deck.duration,
    currentTime: deck.currentTime,
    bpm: deck.bpm,
    detectedBpm: deck.detectedBpm,
    key: deck.key,
    pitch: deck.pitch,
    tempo: deck.tempo,
    tempoRange: deck.tempoRange,
    volume: deck.volume,
    eqHigh: deck.eqHigh,
    eqMid: deck.eqMid,
    eqLow: deck.eqLow,
    hotCues: deck.hotCues.map((c) => ({ ...c })),
    loop: { ...deck.loop },
    isMaster: deck.isMaster,
    isReverse: deck.isReverse,
    isKeylock: deck.isKeylock,
    waveformData: deck.waveformData ? Array.from(deck.waveformData) : null,
    waveformColors: deck.waveformColors ? Array.from(deck.waveformColors) : null,
    cuePoint: deck.cuePoint,
    gain: deck.gain,
  };
}

function serializeSampler(pads: SamplerPad[], bank: 'A' | 'B' | 'C' | 'D'): SerializedSampler {
  return {
    pads: pads.map((p): SerializedSamplerPad => ({
      id: p.id,
      trackId: p.trackId,
      trackName: p.trackName,
      color: p.color,
      volume: p.volume,
      pitch: p.pitch,
      mode: p.mode,
      waveformData: p.waveformData ? Array.from(p.waveformData) : null,
      keyBinding: p.keyBinding,
    })),
    bank,
  };
}

// ─── Audio File Cache (used by TrackLibrary) ─────────────────────────────────
// We need to access the TrackLibrary's audioBufferCache to persist deck audio.
// Since it's a module-level Map, we import it if available or skip deck audio.

let _trackLibraryAudioCache: Map<string, ArrayBuffer> | null = null;

export function registerTrackLibraryAudioCache(cache: Map<string, ArrayBuffer>): void {
  _trackLibraryAudioCache = cache;
}

// ─── ProjectManager ──────────────────────────────────────────────────────────

export class ProjectManager {

  // ── Serialize current state → SavedProject ──────────────────────────────

  static async serializeCurrentState(name?: string): Promise<SavedProject> {
    const djState = useDJStore.getState();
    const dawState = useDAWStore.getState();
    const sampleState = useSampleStore.getState();
    const projState = useProjectStore.getState();

    const projectId = projState.currentProjectId ?? crypto.randomUUID();
    const projectName = name ?? projState.currentProjectName ?? 'Proyecto sin título';

    // Serialize decks
    const deckA = serializeDeck(djState.decks.A);
    const deckB = serializeDeck(djState.decks.B);

    // Collect audio file references
    const audioFileRefs: AudioFileRef[] = [];
    const savedHashes = new Set<string>();

    // Save deck audio if available in the cache
    if (_trackLibraryAudioCache) {
      for (const [trackId, arrayBuffer] of _trackLibraryAudioCache.entries()) {
        const hash = await hashArrayBuffer(arrayBuffer);
        if (!savedHashes.has(hash)) {
          await dbSaveAudioFile(hash, {
            arrayBuffer,
            name: trackId,
            size: arrayBuffer.byteLength,
          });
          audioFileRefs.push({ hash, name: trackId, size: arrayBuffer.byteLength });
          savedHashes.add(hash);
        }
        // Link deck to hash
        if (djState.decks.A.trackName && trackId.includes(djState.decks.A.trackName.replace(/\.[^.]+$/, ''))) {
          deckA.trackFileHash = hash;
        }
        if (djState.decks.B.trackName && trackId.includes(djState.decks.B.trackName.replace(/\.[^.]+$/, ''))) {
          deckB.trackFileHash = hash;
        }
      }
    }

    // Save DAW clip audio
    const dawProject: DAWProject = JSON.parse(JSON.stringify(dawState.project));
    for (const track of dawProject.tracks) {
      for (const clip of track.clips) {
        if (clip.audioFileId) {
          // Check if we have the buffer in DAWEngine cache
          const buffer = getAudioBuffer(clip.audioFileId);
          if (buffer && !savedHashes.has(clip.audioFileId)) {
            // We don't have the raw ArrayBuffer, only the decoded AudioBuffer.
            // For DAW clips loaded from the sample store or track library,
            // the audioFileId IS the hash already.
            // We'll save what we can from TrackLibrary cache.
            if (_trackLibraryAudioCache?.has(clip.audioFileId)) {
              const ab = _trackLibraryAudioCache.get(clip.audioFileId)!;
              const hash = await hashArrayBuffer(ab);
              await dbSaveAudioFile(hash, {
                arrayBuffer: ab,
                name: clip.name,
                size: ab.byteLength,
              });
              audioFileRefs.push({ hash, name: clip.name, size: ab.byteLength });
              savedHashes.add(hash);
              // Update clip reference to use hash
              clip.audioFileId = hash;
            } else {
              // audioFileId may already be a valid reference (sample or hash)
              if (!savedHashes.has(clip.audioFileId)) {
                audioFileRefs.push({ hash: clip.audioFileId, name: clip.name, size: 0 });
                savedHashes.add(clip.audioFileId);
              }
            }
          }
        }
      }
    }

    const project: SavedProject = {
      id: projectId,
      name: projectName,
      createdAt: projState.currentProjectId ? (dawState.project.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now(),
      appVersion: APP_VERSION,
      dj: {
        deckA,
        deckB,
        mixer: { ...djState.mixer },
        effects: djState.effects.map((e) => ({ ...e, params: { ...e.params } })),
        sampler: serializeSampler(djState.sampler.pads, djState.sampler.bank),
      },
      daw: dawProject,
      drumMachine: JSON.parse(JSON.stringify(sampleState.dm)),
      audioFileRefs,
    };

    return project;
  }

  // ── Save ────────────────────────────────────────────────────────────────

  static async save(name?: string): Promise<string> {
    const projStore = useProjectStore.getState();
    projStore.setSaving(true);

    try {
      const project = await ProjectManager.serializeCurrentState(name);
      await dbSaveProject(project);

      projStore.setCurrentProject(project.id, project.name);
      projStore.setSaved(true);
      projStore.setSaving(false);

      // Refresh recent projects list
      const recent = await dbListProjects();
      projStore.setRecentProjects(recent);

      return project.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al guardar';
      projStore.setSaveError(msg);
      console.error('ProjectManager.save failed:', err);
      throw err;
    }
  }

  // ── Load ────────────────────────────────────────────────────────────────

  static async load(
    projectId: string,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    const projStore = useProjectStore.getState();
    projStore.setLoading(true);
    projStore.setLoadingProgress(0);

    try {
      const project = await dbLoadProject(projectId);
      if (!project) throw new Error('Proyecto no encontrado');

      // 1. Collect unique audio file IDs to load
      const audioIds = new Set<string>();

      if (project.dj.deckA.trackFileHash) audioIds.add(project.dj.deckA.trackFileHash);
      if (project.dj.deckB.trackFileHash) audioIds.add(project.dj.deckB.trackFileHash);

      for (const track of project.daw.tracks) {
        for (const clip of track.clips) {
          if (clip.audioFileId) audioIds.add(clip.audioFileId);
        }
      }

      const uniqueIds = [...audioIds];
      let loaded = 0;

      // 2. Load & decode audio buffers in parallel
      if (uniqueIds.length > 0 && audioEngine.isInitialized()) {
        await Promise.all(uniqueIds.map(async (fileId) => {
          try {
            const arrayBuffer = await dbLoadAudioFile(fileId);
            if (arrayBuffer) {
              const audioBuf = await audioEngine.decodeAudioData(arrayBuffer.slice(0));
              storeAudioBuffer(fileId, audioBuf);

              // Also populate TrackLibrary cache if available
              if (_trackLibraryAudioCache) {
                _trackLibraryAudioCache.set(fileId, arrayBuffer);
              }
            }
          } catch (err) {
            console.warn(`Failed to decode audio ${fileId}:`, err);
          }
          loaded++;
          const pct = loaded / uniqueIds.length;
          onProgress?.(pct);
          projStore.setLoadingProgress(pct);
        }));
      }

      // 3. Restore DJ store
      const dj = useDJStore.getState();
      dj.setDeckTrack('A', {
        trackName: project.dj.deckA.trackName,
        artistName: project.dj.deckA.artistName,
        duration: project.dj.deckA.duration,
        currentTime: project.dj.deckA.currentTime,
        bpm: project.dj.deckA.bpm,
        detectedBpm: project.dj.deckA.detectedBpm,
        key: project.dj.deckA.key,
        pitch: project.dj.deckA.pitch,
        tempo: project.dj.deckA.tempo,
        tempoRange: project.dj.deckA.tempoRange,
        volume: project.dj.deckA.volume,
        eqHigh: project.dj.deckA.eqHigh,
        eqMid: project.dj.deckA.eqMid,
        eqLow: project.dj.deckA.eqLow,
        hotCues: project.dj.deckA.hotCues,
        loop: project.dj.deckA.loop,
        isMaster: project.dj.deckA.isMaster,
        isReverse: project.dj.deckA.isReverse,
        isKeylock: project.dj.deckA.isKeylock,
        waveformData: project.dj.deckA.waveformData ? new Float32Array(project.dj.deckA.waveformData) : null,
        waveformColors: project.dj.deckA.waveformColors ? new Uint8Array(project.dj.deckA.waveformColors) : null,
        cuePoint: project.dj.deckA.cuePoint,
        gain: project.dj.deckA.gain,
      });

      dj.setDeckTrack('B', {
        trackName: project.dj.deckB.trackName,
        artistName: project.dj.deckB.artistName,
        duration: project.dj.deckB.duration,
        currentTime: project.dj.deckB.currentTime,
        bpm: project.dj.deckB.bpm,
        detectedBpm: project.dj.deckB.detectedBpm,
        key: project.dj.deckB.key,
        pitch: project.dj.deckB.pitch,
        tempo: project.dj.deckB.tempo,
        tempoRange: project.dj.deckB.tempoRange,
        volume: project.dj.deckB.volume,
        eqHigh: project.dj.deckB.eqHigh,
        eqMid: project.dj.deckB.eqMid,
        eqLow: project.dj.deckB.eqLow,
        hotCues: project.dj.deckB.hotCues,
        loop: project.dj.deckB.loop,
        isMaster: project.dj.deckB.isMaster,
        isReverse: project.dj.deckB.isReverse,
        isKeylock: project.dj.deckB.isKeylock,
        waveformData: project.dj.deckB.waveformData ? new Float32Array(project.dj.deckB.waveformData) : null,
        waveformColors: project.dj.deckB.waveformColors ? new Uint8Array(project.dj.deckB.waveformColors) : null,
        cuePoint: project.dj.deckB.cuePoint,
        gain: project.dj.deckB.gain,
      });

      // Restore mixer
      dj.setCrossfader(project.dj.mixer.crossfaderPosition);
      dj.setCrossfaderCurve(project.dj.mixer.crossfaderCurve);
      dj.setMasterGain(project.dj.mixer.masterGain);

      // Restore effects
      for (let i = 0; i < project.dj.effects.length; i++) {
        const eff = project.dj.effects[i];
        dj.setEffectEnabled(eff.id, eff.enabled);
        dj.setEffectTarget(eff.id, eff.target);
        for (const [param, value] of Object.entries(eff.params)) {
          dj.setEffectParam(eff.id, param, value);
        }
      }

      // Restore sampler pads
      for (const pad of project.dj.sampler.pads) {
        dj.setSamplerPad(pad.id, {
          trackId: pad.trackId,
          trackName: pad.trackName,
          color: pad.color,
          volume: pad.volume,
          pitch: pad.pitch,
          mode: pad.mode,
          waveformData: pad.waveformData ? new Float32Array(pad.waveformData) : null,
          keyBinding: pad.keyBinding,
        });
      }
      dj.setSamplerBank(project.dj.sampler.bank);

      // 4. Restore DAW store
      useDAWStore.getState().loadProject(project.daw);

      // 5. Restore drum machine
      const sampleStore = useSampleStore.getState();
      // We use immer-safe approach: set dm fields individually
      // Since dm is a complex nested object, we do a full replacement via set
      useSampleStore.setState((s) => {
        s.dm = {
          ...project.drumMachine,
          playing: false,       // Never auto-play on load
          currentStep: 0,
        };
      });

      // 6. Update project store
      projStore.setCurrentProject(project.id, project.name);
      projStore.setSaved(true);
      projStore.setLoading(false);
      projStore.setLoadingProgress(1);

      console.log(`Project "${project.name}" loaded successfully`);

    } catch (err) {
      projStore.setLoading(false);
      console.error('ProjectManager.load failed:', err);
      throw err;
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  static async delete(projectId: string): Promise<void> {
    await dbDeleteProject(projectId);
    const recent = await dbListProjects();
    useProjectStore.getState().setRecentProjects(recent);
  }

  // ── Export as .jbproject (ZIP) ───────────────────────────────────────────

  static async exportToFile(projectId: string): Promise<void> {
    const project = await dbLoadProject(projectId);
    if (!project) throw new Error('Proyecto no encontrado');

    // Dynamic import fflate (already in dependencies)
    const { zipSync, strToU8 } = await import('fflate');

    const zipData: Record<string, Uint8Array> = {};

    // Add project JSON
    zipData['project.json'] = strToU8(JSON.stringify(project, null, 2));

    // Add all referenced audio files
    for (const ref of project.audioFileRefs) {
      const ab = await dbLoadAudioFile(ref.hash);
      if (ab) {
        zipData[`audio/${ref.hash}`] = new Uint8Array(ab);
      }
    }

    const zipped = zipSync(zipData, { level: 3 });
    const blob = new Blob([zipped], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.jbproject`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Import from .jbproject ──────────────────────────────────────────────

  static async importFromFile(file: File): Promise<string> {
    const { unzipSync, strFromU8 } = await import('fflate');

    const arrayBuffer = await file.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(arrayBuffer));

    // Read project JSON
    const projectJsonU8 = unzipped['project.json'];
    if (!projectJsonU8) throw new Error('Archivo .jbproject inválido: falta project.json');

    const project: SavedProject = JSON.parse(strFromU8(projectJsonU8));

    // Assign new ID to avoid conflicts
    project.id = crypto.randomUUID();
    project.name = project.name + ' (importado)';
    project.updatedAt = Date.now();

    // Restore audio files
    for (const key of Object.keys(unzipped)) {
      if (key.startsWith('audio/')) {
        const hash = key.replace('audio/', '');
        const audioData = unzipped[key];
        await dbSaveAudioFile(hash, {
          arrayBuffer: audioData.buffer.slice(
            audioData.byteOffset,
            audioData.byteOffset + audioData.byteLength,
          ),
          name: hash,
          size: audioData.byteLength,
        });
      }
    }

    // Save project to IDB
    await dbSaveProject(project);

    // Refresh list
    const recent = await dbListProjects();
    useProjectStore.getState().setRecentProjects(recent);

    return project.id;
  }

  // ── Auto-save ───────────────────────────────────────────────────────────

  static startAutoSave(intervalMs = 60_000): () => void {
    const timer = setInterval(async () => {
      const projState = useProjectStore.getState();
      if (projState.currentProjectId && !projState.isSaved && !projState.isSaving) {
        try {
          await ProjectManager.save();
          console.log('Auto-save completado');
        } catch (err) {
          console.warn('Auto-save failed:', err);
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }

  // ── Refresh recent projects list ────────────────────────────────────────

  static async refreshProjectList(): Promise<void> {
    const recent = await dbListProjects();
    useProjectStore.getState().setRecentProjects(recent);
  }

  // ── Cleanup orphaned audio ──────────────────────────────────────────────

  static async cleanupOrphanedAudio(): Promise<number> {
    const projects = await dbListProjects();
    const allProjects = await Promise.all(
      projects.map((p) => dbLoadProject(p.id)),
    );

    // Collect all referenced hashes
    const referencedHashes = new Set<string>();
    for (const proj of allProjects) {
      if (!proj) continue;
      for (const ref of proj.audioFileRefs) {
        referencedHashes.add(ref.hash);
      }
    }

    // Find orphaned keys
    const allKeys = await dbListAudioFileKeys();
    let deleted = 0;
    for (const key of allKeys) {
      if (!referencedHashes.has(key)) {
        await dbDeleteAudioFile(key);
        deleted++;
      }
    }

    return deleted;
  }
}
