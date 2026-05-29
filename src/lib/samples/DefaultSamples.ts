// ─── DefaultSamples — procedural sample generation via Web Audio API ──────────
// All synthesis done with OfflineAudioContext, no external files needed.

import type { SampleItem, SampleCategory } from '@/src/store/sampleTypes';
import { hashArrayBuffer } from './SampleManager';
import { dbSaveBuffer, dbSaveSample, markBuiltinGenerated } from './SampleDatabase';

export const BUILTIN_PACK_ID = 'builtin';

// ─── Offline render helper ───────────────────────────────────────────────────

async function render(
  durationSec: number,
  sampleRate: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<AudioBuffer> {
  const len = Math.ceil(durationSec * sampleRate);
  const ctx = new OfflineAudioContext(1, len, sampleRate);
  build(ctx);
  return ctx.startRendering();
}

function bufferToArrayBuffer(buffer: AudioBuffer): ArrayBuffer {
  const len = buffer.length;
  const out = new Float32Array(len);
  buffer.copyFromChannel(out, 0);
  const ab = new ArrayBuffer(len * 4 + 44);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + len * 4, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true); // IEEE float
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 32, true);
  writeStr(36, 'data');
  view.setUint32(40, len * 4, true);
  for (let i = 0; i < len; i++) view.setFloat32(44 + i * 4, out[i], true);
  return ab;
}

function audioBufferToWaveform(buffer: AudioBuffer): number[] {
  const ch = buffer.getChannelData(0);
  const POINTS = 200;
  const block = Math.max(1, Math.floor(ch.length / POINTS));
  const out: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    let max = 0;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(ch[i * block + j] ?? 0);
      if (v > max) max = v;
    }
    out.push(max);
  }
  return out;
}

async function makeSampleItem(
  name: string, category: SampleCategory, tags: string[],
  buffer: AudioBuffer, raw: ArrayBuffer,
): Promise<SampleItem> {
  const id = await hashArrayBuffer(raw);
  const waveformData = audioBufferToWaveform(buffer);
  const ch = buffer.getChannelData(0);
  let peak = 0; let sumSq = 0;
  for (let i = 0; i < ch.length; i++) {
    const a = Math.abs(ch[i]);
    if (a > peak) peak = a;
    sumSq += a * a;
  }
  const rms = Math.sqrt(sumSq / ch.length);
  return {
    id, name,
    packId: BUILTIN_PACK_ID,
    category,
    type: category.includes('loop') || category.includes('loops') ? 'loop' :
          (category === 'drops' || category === 'rises' || category === 'sweeps' || category === 'noise' ? 'fx' : 'one-shot'),
    duration: buffer.duration,
    tags: [BUILTIN_PACK_ID, ...tags],
    isFavorite: false, rating: 0, usageCount: 0,
    waveformData, rms, peak, notes: '', colorLabel: 0, createdAt: Date.now(),
  };
}

// ─── Synthesis recipes ───────────────────────────────────────────────────────

const SR = 44100;

// Kick: 808-style
async function kick808(): Promise<AudioBuffer> {
  return render(0.8, SR, (ctx) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, 0);
    osc.frequency.exponentialRampToValueAtTime(40, 0.08);
    env.gain.setValueAtTime(1, 0);
    env.gain.exponentialRampToValueAtTime(0.001, 0.7);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(0); osc.stop(0.8);
  });
}

// Kick: punchy
async function kickPunchy(): Promise<AudioBuffer> {
  return render(0.5, SR, (ctx) => {
    const osc = ctx.createOscillator();
    const noise = ctx.createBufferSource();
    const noiseBuf = ctx.createBuffer(1, SR * 0.05, SR);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.4;
    noise.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 2000;
    const env = ctx.createGain();
    const noiseEnv = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(160, 0); osc.frequency.exponentialRampToValueAtTime(50, 0.05);
    env.gain.setValueAtTime(0.8, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.4);
    noiseEnv.gain.setValueAtTime(1, 0); noiseEnv.gain.exponentialRampToValueAtTime(0.001, 0.05);
    noise.connect(filt); filt.connect(noiseEnv); noiseEnv.connect(ctx.destination);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(0); osc.stop(0.5); noise.start(0);
  });
}

// Kick: sub pure
async function kickSub(): Promise<AudioBuffer> {
  return render(1.0, SR, (ctx) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 60;
    env.gain.setValueAtTime(1, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.9);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(0); osc.stop(1.0);
  });
}

// Kick: clicky
async function kickClicky(): Promise<AudioBuffer> {
  return render(0.3, SR, (ctx) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(1000, 0); osc.frequency.exponentialRampToValueAtTime(60, 0.01);
    env.gain.setValueAtTime(1, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.25);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(0); osc.stop(0.3);
  });
}

// Snare: classic
async function snareClassic(): Promise<AudioBuffer> {
  return render(0.4, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 0.4, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 3000; filt.Q.value = 0.5;
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 200;
    const noiseEnv = ctx.createGain(); const oscEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.8, 0); noiseEnv.gain.exponentialRampToValueAtTime(0.001, 0.35);
    oscEnv.gain.setValueAtTime(0.5, 0); oscEnv.gain.exponentialRampToValueAtTime(0.001, 0.1);
    noise.connect(filt); filt.connect(noiseEnv); noiseEnv.connect(ctx.destination);
    osc.connect(oscEnv); oscEnv.connect(ctx.destination);
    noise.start(0); osc.start(0); osc.stop(0.4);
  });
}

// Snare: tight
async function snareTight(): Promise<AudioBuffer> {
  return render(0.2, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 0.2, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 4000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.18);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// Clap
async function clap(): Promise<AudioBuffer> {
  return render(0.3, SR, (ctx) => {
    const master = ctx.createGain();
    master.connect(ctx.destination);
    for (let burst = 0; burst < 3; burst++) {
      const noise = ctx.createBufferSource();
      const nb = ctx.createBuffer(1, SR * 0.02, SR);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      noise.buffer = nb;
      const env = ctx.createGain();
      const t = burst * 0.012;
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.8, t + 0.001);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(env); env.connect(master);
      noise.start(t);
    }
  });
}

// Rimshot
async function rimshot(): Promise<AudioBuffer> {
  return render(0.15, SR, (ctx) => {
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 800;
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 0.15, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.4;
    noise.buffer = nb;
    const env1 = ctx.createGain(); const env2 = ctx.createGain();
    env1.gain.setValueAtTime(1, 0); env1.gain.exponentialRampToValueAtTime(0.001, 0.08);
    env2.gain.setValueAtTime(0.5, 0); env2.gain.exponentialRampToValueAtTime(0.001, 0.1);
    osc.connect(env1); env1.connect(ctx.destination);
    noise.connect(env2); env2.connect(ctx.destination);
    osc.start(0); osc.stop(0.15); noise.start(0);
  });
}

// Hi-hat closed
async function hhClosed(): Promise<AudioBuffer> {
  return render(0.08, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 0.08, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 8000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.7, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.06);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// Hi-hat open
async function hhOpen(): Promise<AudioBuffer> {
  return render(0.5, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 0.5, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 7000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.7, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.45);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// Hi-hat pedal
async function hhPedal(): Promise<AudioBuffer> {
  return render(0.06, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 0.06, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.5;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 9000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.5, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.05);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// Crash
async function crash(): Promise<AudioBuffer> {
  return render(2.5, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 2.5, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 6000; filt.Q.value = 0.3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.9, 0); env.gain.exponentialRampToValueAtTime(0.001, 2.4);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// Conga
async function conga(): Promise<AudioBuffer> {
  return render(0.3, SR, (ctx) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(300, 0); osc.frequency.exponentialRampToValueAtTime(200, 0.05);
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.25);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(0); osc.stop(0.3);
  });
}

// Shaker
async function shaker(): Promise<AudioBuffer> {
  return render(0.12, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 0.12, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 5000; filt.Q.value = 2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.8, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.1);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// Tambourine
async function tambourine(): Promise<AudioBuffer> {
  return render(0.25, SR, (ctx) => {
    const master = ctx.createGain(); master.connect(ctx.destination);
    for (let i = 0; i < 5; i++) {
      const noise = ctx.createBufferSource();
      const nb = ctx.createBuffer(1, SR * 0.02, SR);
      const nd = nb.getChannelData(0);
      for (let j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
      noise.buffer = nb;
      const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 6000;
      const env = ctx.createGain(); const t = i * 0.04;
      env.gain.setValueAtTime(0.6, t); env.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      noise.connect(filt); filt.connect(env); env.connect(master);
      noise.start(t);
    }
  });
}

// Woodblock
async function woodblock(): Promise<AudioBuffer> {
  return render(0.06, SR, (ctx) => {
    const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 600;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.05);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(0); osc.stop(0.06);
  });
}

// Noise riser (4 beats at 120bpm = 2s)
async function noiseRiser(): Promise<AudioBuffer> {
  return render(2.0, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 2, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    filt.frequency.setValueAtTime(200, 0); filt.frequency.exponentialRampToValueAtTime(20000, 1.9);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.01, 0); env.gain.linearRampToValueAtTime(0.8, 1.9);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// Sub drop
async function subDrop(): Promise<AudioBuffer> {
  return render(2.5, SR, (ctx) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(80, 0); osc.frequency.exponentialRampToValueAtTime(20, 2.4);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.9, 0); env.gain.exponentialRampToValueAtTime(0.001, 2.4);
    osc.connect(env); env.connect(ctx.destination);
    osc.start(0); osc.stop(2.5);
  });
}

// Impact
async function impact(): Promise<AudioBuffer> {
  return render(1.2, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 1.2, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) {
      const decay = Math.exp(-i / (SR * 0.3));
      nd[i] = (Math.random() * 2 - 1) * decay;
    }
    noise.buffer = nb;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 60;
    const subEnv = ctx.createGain();
    subEnv.gain.setValueAtTime(1, 0); subEnv.gain.exponentialRampToValueAtTime(0.001, 0.5);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 3000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, 0); env.gain.exponentialRampToValueAtTime(0.001, 1.0);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    sub.connect(subEnv); subEnv.connect(ctx.destination);
    noise.start(0); sub.start(0); sub.stop(1.2);
  });
}

// Vinyl stop
async function vinylStop(): Promise<AudioBuffer> {
  return render(1.5, SR, (ctx) => {
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, SR * 1.5, SR);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.3;
    noise.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
    filt.frequency.setValueAtTime(8000, 0); filt.frequency.exponentialRampToValueAtTime(200, 1.4);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.7, 0); env.gain.linearRampToValueAtTime(0.001, 1.4);
    noise.connect(filt); filt.connect(env); env.connect(ctx.destination);
    noise.start(0);
  });
}

// ─── Build recipe table ───────────────────────────────────────────────────────

interface Recipe {
  name: string;
  category: SampleCategory;
  tags: string[];
  fn: () => Promise<AudioBuffer>;
}

const RECIPES: Recipe[] = [
  { name: 'Kick 808',       category: 'kicks',       tags: ['kick','808','sub'],       fn: kick808 },
  { name: 'Kick Punchy',    category: 'kicks',       tags: ['kick','punchy'],          fn: kickPunchy },
  { name: 'Kick Sub',       category: 'kicks',       tags: ['kick','sub','deep'],      fn: kickSub },
  { name: 'Kick Clicky',    category: 'kicks',       tags: ['kick','clicky','snap'],   fn: kickClicky },
  { name: 'Snare Classic',  category: 'snares',      tags: ['snare','classic'],        fn: snareClassic },
  { name: 'Snare Tight',    category: 'snares',      tags: ['snare','tight','crisp'],  fn: snareTight },
  { name: 'Clap',           category: 'snares',      tags: ['clap','snap'],            fn: clap },
  { name: 'Rimshot',        category: 'snares',      tags: ['rimshot','rim'],          fn: rimshot },
  { name: 'HH Closed',      category: 'hihat',       tags: ['hihat','closed','tight'], fn: hhClosed },
  { name: 'HH Open',        category: 'hihat',       tags: ['hihat','open'],           fn: hhOpen },
  { name: 'HH Pedal',       category: 'hihat',       tags: ['hihat','pedal','soft'],   fn: hhPedal },
  { name: 'Crash',          category: 'cymbals',     tags: ['crash','cymbal'],         fn: crash },
  { name: 'Conga',          category: 'percussion',  tags: ['conga','percussion'],     fn: conga },
  { name: 'Shaker',         category: 'percussion',  tags: ['shaker','percussion'],    fn: shaker },
  { name: 'Tambourine',     category: 'percussion',  tags: ['tambourine','perc'],      fn: tambourine },
  { name: 'Woodblock',      category: 'percussion',  tags: ['woodblock','wood'],       fn: woodblock },
  { name: 'Noise Riser',    category: 'rises',       tags: ['riser','build','noise'],  fn: noiseRiser },
  { name: 'Sub Drop',       category: 'drops',       tags: ['drop','sub','impact'],    fn: subDrop },
  { name: 'Impact',         category: 'drops',       tags: ['impact','hit','fx'],      fn: impact },
  { name: 'Vinyl Stop',     category: 'vinyl',       tags: ['vinyl','stop','fx'],      fn: vinylStop },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateBuiltinSamples(
  onProgress?: (current: number, total: number) => void,
): Promise<SampleItem[]> {
  const items: SampleItem[] = [];
  const total = RECIPES.length;

  for (let i = 0; i < total; i++) {
    const recipe = RECIPES[i];
    onProgress?.(i, total);
    const buffer = await recipe.fn();
    const raw = bufferToArrayBuffer(buffer);
    const item = await makeSampleItem(recipe.name, recipe.category, recipe.tags, buffer, raw);

    // Persist to IndexedDB
    await dbSaveBuffer(item.id, raw);
    await dbSaveSample(item);
    items.push(item);

    // Keep decoded buffer in memory too
    const { sampleManager } = await import('./SampleManager');
    sampleManager.storeBuffer(item.id, buffer);
  }

  await markBuiltinGenerated();
  return items;
}
