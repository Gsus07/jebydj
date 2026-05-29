// ─── ProceduralSounds — all built-in sounds generated via OfflineAudioContext ─
// No external files. All synthesis is deterministic and runs in < 1 second.

import type { SampleCategory } from '@/src/store/sampleTypes';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ProceduralSound {
  id: string;
  name: string;
  category: SampleCategory;
  subcategory: string;
  buffer: AudioBuffer;
  duration: number;
  tags: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function offline(
  channels: number,
  durationSec: number,
  sampleRate: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<AudioBuffer> {
  const len = Math.ceil(durationSec * sampleRate);
  const ctx = new OfflineAudioContext(channels, len, sampleRate);
  build(ctx);
  return ctx.startRendering();
}

function whiteNoise(ctx: OfflineAudioContext, durationSec: number): AudioBufferSourceNode {
  const len = Math.ceil(durationSec * ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function tanhCurve(degree: number): Float32Array<ArrayBuffer> {
  const n = 256;
  const buf = new ArrayBuffer(n * 4);
  const c = new Float32Array(buf);
  const td = Math.tanh(degree);
  for (let i = 0; i < n; i++) {
    const x = (2 * i) / (n - 1) - 1;
    c[i] = Math.tanh(degree * x) / td;
  }
  return c;
}

// ─── Hi-hat metallic core (6 square oscillators) ────────────────────────────

function buildHiHat(ctx: OfflineAudioContext, decayTime: number, masterVol = 1.0): void {
  const FREQS = [210, 270, 335, 540, 800, 1000];
  const mix = ctx.createGain();
  mix.gain.value = 1;

  for (const freq of FREQS) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0.15;
    osc.connect(g);
    g.connect(mix);
    osc.start(0);
    osc.stop(Math.min(decayTime + 0.01, ctx.length / ctx.sampleRate));
  }

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;

  const peak = ctx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 10000;
  peak.gain.value = 6;
  peak.Q.value = 1;

  const env = ctx.createGain();
  env.gain.setValueAtTime(masterVol, 0);
  env.gain.exponentialRampToValueAtTime(0.001, decayTime);

  mix.connect(hp);
  hp.connect(peak);
  peak.connect(env);
  env.connect(ctx.destination);
}

// ─── Kick generators ─────────────────────────────────────────────────────────

function genKick808(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.8, sr, (ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, 0);
    osc.frequency.exponentialRampToValueAtTime(40, 0.08);
    osc.frequency.exponentialRampToValueAtTime(30, 0.5);
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.8);
  });
}

function genKickPunchy(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.4, sr, (ctx) => {
    // Body
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, 0);
    osc.frequency.exponentialRampToValueAtTime(45, 0.05);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(1.0, 0);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, 0.35);
    osc.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    osc.start(0); osc.stop(0.4);

    // Transient click
    const noise = whiteNoise(ctx, 0.02);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 2500;
    bpf.Q.value = 0.8;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.4, 0);
    clickGain.gain.exponentialRampToValueAtTime(0.001, 0.02);
    noise.connect(bpf);
    bpf.connect(clickGain);
    clickGain.connect(ctx.destination);
    noise.start(0);
  });
}

function genKickDeep(sr: number): Promise<AudioBuffer> {
  return offline(1, 1.0, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, 0);
    osc.frequency.exponentialRampToValueAtTime(35, 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.9);
    const shaper = ctx.createWaveShaper();
    shaper.curve = tanhCurve(1.5);
    osc.connect(gain);
    gain.connect(shaper);
    shaper.connect(ctx.destination);
    osc.start(0); osc.stop(1.0);
  });
}

function genKickClicky(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.3, sr, (ctx) => {
    // Sub
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, 0);
    osc.frequency.exponentialRampToValueAtTime(50, 0.03);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.0, 0);
    subGain.gain.exponentialRampToValueAtTime(0.001, 0.25);
    osc.connect(subGain); subGain.connect(ctx.destination);
    osc.start(0); osc.stop(0.3);

    // Click
    const click = whiteNoise(ctx, 0.005);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.8, 0);
    clickGain.gain.exponentialRampToValueAtTime(0.001, 0.008);
    click.connect(hp); hp.connect(clickGain); clickGain.connect(ctx.destination);
    click.start(0);
  });
}

// ─── Snare generators ─────────────────────────────────────────────────────────

function genSnareClassic(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.3, sr, (ctx) => {
    // Tone
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 200;
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.7, 0);
    toneGain.gain.exponentialRampToValueAtTime(0.001, 0.15);
    osc.connect(toneGain); toneGain.connect(ctx.destination);
    osc.start(0); osc.stop(0.3);

    // Noise snare
    const noise = whiteNoise(ctx, 0.3);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 4000; bpf.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, 0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, 0.25);
    noise.connect(bpf); bpf.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(0);
  });
}

function genSnareTight(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.2, sr, (ctx) => {
    // Tone
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 180;
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.5, 0);
    toneGain.gain.exponentialRampToValueAtTime(0.001, 0.08);
    osc.connect(toneGain); toneGain.connect(ctx.destination);
    osc.start(0); osc.stop(0.2);

    // Resonant noise
    const noise = whiteNoise(ctx, 0.2);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 6000; bpf.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, 0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, 0.15);
    noise.connect(bpf); bpf.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(0);

    // Transient
    const trans = whiteNoise(ctx, 0.005);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 8000;
    const transGain = ctx.createGain();
    transGain.gain.setValueAtTime(0.6, 0);
    transGain.gain.exponentialRampToValueAtTime(0.001, 0.008);
    trans.connect(hp); hp.connect(transGain); transGain.connect(ctx.destination);
    trans.start(0);
  });
}

function genSnareRimshot(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.25, sr, (ctx) => {
    // Metallic tone
    const osc = ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = 400;
    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(0.3, 0);
    toneGain.gain.exponentialRampToValueAtTime(0.001, 0.05);
    osc.connect(toneGain); toneGain.connect(ctx.destination);
    osc.start(0); osc.stop(0.25);

    // Noise
    const noise = whiteNoise(ctx, 0.25);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 5000; bpf.Q.value = 2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, 0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, 0.2);
    noise.connect(bpf); bpf.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(0);
  });
}

// ─── Clap generators ─────────────────────────────────────────────────────────

function genClapClassic(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.4, sr, (ctx) => {
    for (const offset of [0, 0.01, 0.022]) {
      const noise = whiteNoise(ctx, 0.05);
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass'; bpf.frequency.value = 1200; bpf.Q.value = 0.5;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, offset);
      g.gain.linearRampToValueAtTime(1.0, offset + 0.002);
      g.gain.exponentialRampToValueAtTime(0.001, offset + 0.08);
      noise.connect(bpf); bpf.connect(hp); hp.connect(g); g.connect(ctx.destination);
      noise.start(offset);
    }
  });
}

function genClapSnap(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.2, sr, (ctx) => {
    const noise = whiteNoise(ctx, 0.2);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 2500; bpf.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.15);
    noise.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination);
    noise.start(0);
  });
}

// ─── Hi-hat generators ────────────────────────────────────────────────────────

function genHiHatClosed(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.12, sr, (ctx) => { buildHiHat(ctx, 0.05); });
}

function genHiHatOpen(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.55, sr, (ctx) => { buildHiHat(ctx, 0.45); });
}

function genHiHatPedal(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.1, sr, (ctx) => { buildHiHat(ctx, 0.04, 0.6); });
}

function genHiHatCrash(sr: number): Promise<AudioBuffer> {
  return offline(1, 2.0, sr, (ctx) => {
    buildHiHat(ctx, 1.8);
    // Extra noise layer
    const noise = whiteNoise(ctx, 2.0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 12000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, 0);
    g.gain.exponentialRampToValueAtTime(0.001, 1.8);
    noise.connect(lp); lp.connect(g); g.connect(ctx.destination);
    noise.start(0);
  });
}

// ─── Percussion generators ────────────────────────────────────────────────────

function genPercCongaHi(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.3, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, 0);
    osc.frequency.exponentialRampToValueAtTime(200, 0.02);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.25);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.3);
  });
}

function genPercCongaLo(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.35, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, 0);
    osc.frequency.exponentialRampToValueAtTime(140, 0.025);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.3);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.35);
  });
}

function genPercBongo(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.2, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, 0);
    osc.frequency.exponentialRampToValueAtTime(350, 0.015);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.18);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.2);
  });
}

function genPercShaker(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.1, sr, (ctx) => {
    const noise = whiteNoise(ctx, 0.08);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 7000; bpf.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.8, 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.07);
    noise.connect(bpf); bpf.connect(gain); gain.connect(ctx.destination);
    noise.start(0);
  });
}

function genPercTambourine(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.2, sr, (ctx) => {
    // Noise layer
    const noise = whiteNoise(ctx, 0.2);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 8000; bpf.Q.value = 2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, 0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, 0.15);
    noise.connect(bpf); bpf.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(0);

    // Metallic shimmer
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 4000;
    const shimGain = ctx.createGain();
    shimGain.gain.setValueAtTime(0.3, 0);
    shimGain.gain.exponentialRampToValueAtTime(0.001, 0.01);
    osc.connect(shimGain); shimGain.connect(ctx.destination);
    osc.start(0); osc.stop(0.02);
  });
}

function genPercWoodblock(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.08, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.04);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.06);
  });
}

function genPercCowbell(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.55, sr, (ctx) => {
    const mix = ctx.createGain();
    mix.gain.value = 1;

    for (const freq of [540, 800]) {
      const osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g); g.connect(mix);
      osc.start(0); osc.stop(0.55);
    }

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 2000; bpf.Q.value = 1;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1.0, 0);
    env.gain.exponentialRampToValueAtTime(0.001, 0.5);
    mix.connect(bpf); bpf.connect(env); env.connect(ctx.destination);
  });
}

function genPercRimshot(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.08, sr, (ctx) => {
    const noise = whiteNoise(ctx, 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.06);
    noise.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
    noise.start(0);
  });
}

// ─── FX generators ────────────────────────────────────────────────────────────

function genFxRiser4Beat(sr: number): Promise<AudioBuffer> {
  return offline(1, 4.0, sr, (ctx) => {
    const noise = whiteNoise(ctx, 4.0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(200, 0);
    lp.frequency.exponentialRampToValueAtTime(18000, 3.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, 0);
    gain.gain.linearRampToValueAtTime(1.0, 3.8);
    noise.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    noise.start(0);
  });
}

function genFxDropImpact(sr: number): Promise<AudioBuffer> {
  return offline(1, 1.5, sr, (ctx) => {
    // Sub drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, 0);
    osc.frequency.exponentialRampToValueAtTime(25, 0.5);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.0, 0);
    subGain.gain.exponentialRampToValueAtTime(0.001, 1.2);
    osc.connect(subGain); subGain.connect(ctx.destination);
    osc.start(0); osc.stop(1.5);

    // Noise impact
    const noise = whiteNoise(ctx, 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 800;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, 0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, 0.3);
    noise.connect(lp); lp.connect(noiseGain); noiseGain.connect(ctx.destination);
    noise.start(0);
  });
}

function genFxDownlifter(sr: number): Promise<AudioBuffer> {
  return offline(1, 3.0, sr, (ctx) => {
    const noise = whiteNoise(ctx, 3.0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(18000, 0);
    lp.frequency.exponentialRampToValueAtTime(100, 2.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 2.9);
    noise.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    noise.start(0);
  });
}

function genFxSweepUp(sr: number): Promise<AudioBuffer> {
  return offline(1, 1.0, sr, (ctx) => {
    const noise = whiteNoise(ctx, 1.0);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(400, 0);
    hp.frequency.exponentialRampToValueAtTime(12000, 0.95);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, 0);
    gain.gain.linearRampToValueAtTime(1.0, 0.95);
    noise.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
    noise.start(0);
  });
}

function genFxVinylStop(sr: number): Promise<AudioBuffer> {
  return offline(1, 1.0, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 400;
    osc.frequency.setValueAtTime(400, 0);
    osc.frequency.exponentialRampToValueAtTime(1, 0.8);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.9);
    osc.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(1.0);
  });
}

function genFxCrowdCheer(sr: number): Promise<AudioBuffer> {
  return offline(1, 2.0, sr, (ctx) => {
    const noise = whiteNoise(ctx, 2.0);
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 800; bpf.Q.value = 0.3;

    // Tremolo (LFO)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;

    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.4;

    // Fade in + fade out
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, 0);
    env.gain.linearRampToValueAtTime(1.0, 0.5);
    env.gain.setValueAtTime(1.0, 1.5);
    env.gain.linearRampToValueAtTime(0.001, 2.0);

    lfo.connect(lfoGain);
    lfoGain.connect(mainGain.gain);

    noise.connect(bpf);
    bpf.connect(mainGain);
    mainGain.connect(env);
    env.connect(ctx.destination);

    noise.start(0);
    lfo.start(0); lfo.stop(2.0);
  });
}

function genFxWhiteNoiseHit(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.15, sr, (ctx) => {
    const noise = whiteNoise(ctx, 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.1);
    noise.connect(gain); gain.connect(ctx.destination);
    noise.start(0);
  });
}

function genFxSubBassDrop(sr: number): Promise<AudioBuffer> {
  return offline(1, 2.1, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 60;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(1.0, 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, 2.0);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(2.1);
  });
}

// ─── Bass generators ─────────────────────────────────────────────────────────

function genBass808C(sr: number): Promise<AudioBuffer> {
  return offline(2, 2.0, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, 0);
    osc.frequency.exponentialRampToValueAtTime(65, 0.03); // snap to C2
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 1.8);
    const shaper = ctx.createWaveShaper();
    shaper.curve = tanhCurve(1.5);
    osc.connect(gain); gain.connect(shaper); shaper.connect(ctx.destination);
    osc.start(0); osc.stop(2.0);
  });
}

function genBassSubHit(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.85, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(1.0, 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.8);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.85);
  });
}

function genBassStab(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.2, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 110;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.15);
    osc.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.2);
  });
}

// ─── Melodic generators ───────────────────────────────────────────────────────

function genSynthStabC4(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.45, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 262;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2000, 0);
    lp.frequency.exponentialRampToValueAtTime(500, 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(1.0, 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.4);
    osc.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.45);
  });
}

function genSynthLeadC4(sr: number): Promise<AudioBuffer> {
  return offline(1, 0.65, sr, (ctx) => {
    const osc = ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = 262;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.8, 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, 0.6);
    osc.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    osc.start(0); osc.stop(0.65);
  });
}

function genSynthChord(sr: number): Promise<AudioBuffer> {
  return offline(1, 1.1, sr, (ctx) => {
    const mix = ctx.createGain();
    mix.gain.value = 0.33;
    for (const freq of [262, 330, 392]) { // C-E-G
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      osc.connect(mix);
      osc.start(0); osc.stop(1.1);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.6, 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, 1.0);
    mix.connect(gain); gain.connect(ctx.destination);
  });
}

function genPianoC4(sr: number): Promise<AudioBuffer> {
  return offline(1, 1.3, sr, (ctx) => {
    const mix = ctx.createGain();
    mix.gain.value = 1;

    const addPartial = (freq: number, vol: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = vol;
      osc.connect(g); g.connect(mix);
      osc.start(0); osc.stop(1.3);
    };

    addPartial(262, 1.0);   // fundamental
    addPartial(524, 0.5);   // 2nd harmonic
    addPartial(1048, 0.2);  // 4th harmonic

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(1.0, 0.003);
    gain.gain.linearRampToValueAtTime(0.7, 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, 1.2);
    mix.connect(gain); gain.connect(ctx.destination);
  });
}

// ─── Sound catalog ────────────────────────────────────────────────────────────

interface SoundSpec {
  id: string;
  name: string;
  category: SampleCategory;
  subcategory: string;
  tags: string[];
  gen: (sr: number) => Promise<AudioBuffer>;
}

export const PROCEDURAL_CATALOG: SoundSpec[] = [
  // Kicks
  { id: 'proc_kick_808',      name: 'Kick 808',       category: 'kicks',       subcategory: 'kicks',  tags: ['kick','808','sub'],         gen: genKick808 },
  { id: 'proc_kick_punchy',   name: 'Kick Punchy',    category: 'kicks',       subcategory: 'kicks',  tags: ['kick','punchy','transient'], gen: genKickPunchy },
  { id: 'proc_kick_deep',     name: 'Kick Deep',      category: 'kicks',       subcategory: 'kicks',  tags: ['kick','deep','sub'],         gen: genKickDeep },
  { id: 'proc_kick_clicky',   name: 'Kick Clicky',    category: 'kicks',       subcategory: 'kicks',  tags: ['kick','clicky','snap'],      gen: genKickClicky },
  // Snares
  { id: 'proc_snare_classic', name: 'Snare Classic',  category: 'snares',      subcategory: 'snares', tags: ['snare','classic'],          gen: genSnareClassic },
  { id: 'proc_snare_tight',   name: 'Snare Tight',    category: 'snares',      subcategory: 'snares', tags: ['snare','tight','crisp'],    gen: genSnareTight },
  { id: 'proc_snare_rimshot', name: 'Snare Rimshot',  category: 'snares',      subcategory: 'snares', tags: ['snare','rimshot','metal'],  gen: genSnareRimshot },
  // Claps
  { id: 'proc_clap_classic',  name: 'Clap Classic',   category: 'snares',      subcategory: 'claps',  tags: ['clap','classic'],           gen: genClapClassic },
  { id: 'proc_clap_snap',     name: 'Clap Snap',      category: 'snares',      subcategory: 'claps',  tags: ['clap','snap','short'],      gen: genClapSnap },
  // Hi-hats
  { id: 'proc_hihat_closed',  name: 'HH Closed',      category: 'hihat',       subcategory: 'hihat',  tags: ['hihat','closed'],           gen: genHiHatClosed },
  { id: 'proc_hihat_open',    name: 'HH Open',        category: 'hihat',       subcategory: 'hihat',  tags: ['hihat','open'],             gen: genHiHatOpen },
  { id: 'proc_hihat_pedal',   name: 'HH Pedal',       category: 'hihat',       subcategory: 'hihat',  tags: ['hihat','pedal'],            gen: genHiHatPedal },
  { id: 'proc_hihat_crash',   name: 'Crash',          category: 'cymbals',     subcategory: 'crash',  tags: ['crash','cymbal'],           gen: genHiHatCrash },
  // Percussion
  { id: 'proc_perc_conga_hi', name: 'Conga Hi',       category: 'percussion',  subcategory: 'conga',  tags: ['conga','hi','percussion'],  gen: genPercCongaHi },
  { id: 'proc_perc_conga_lo', name: 'Conga Lo',       category: 'percussion',  subcategory: 'conga',  tags: ['conga','lo','percussion'],  gen: genPercCongaLo },
  { id: 'proc_perc_bongo',    name: 'Bongo',          category: 'percussion',  subcategory: 'bongo',  tags: ['bongo','percussion'],       gen: genPercBongo },
  { id: 'proc_perc_shaker',   name: 'Shaker',         category: 'percussion',  subcategory: 'shaker', tags: ['shaker','hi','percussion'], gen: genPercShaker },
  { id: 'proc_perc_tamb',     name: 'Tambourine',     category: 'percussion',  subcategory: 'tamb',   tags: ['tambourine','perc'],        gen: genPercTambourine },
  { id: 'proc_perc_wood',     name: 'Woodblock',      category: 'percussion',  subcategory: 'wood',   tags: ['woodblock','wood'],         gen: genPercWoodblock },
  { id: 'proc_perc_cowbell',  name: 'Cowbell',        category: 'percussion',  subcategory: 'cowbell',tags: ['cowbell','metal'],          gen: genPercCowbell },
  { id: 'proc_perc_rimshot',  name: 'Rimshot',        category: 'percussion',  subcategory: 'rim',    tags: ['rimshot','rim','snappy'],   gen: genPercRimshot },
  // FX
  { id: 'proc_fx_riser',      name: 'FX Riser 4 Beat',category: 'rises',       subcategory: 'riser',  tags: ['riser','build','noise'],    gen: genFxRiser4Beat },
  { id: 'proc_fx_drop',       name: 'FX Drop Impact', category: 'drops',       subcategory: 'impact', tags: ['drop','impact','sub'],      gen: genFxDropImpact },
  { id: 'proc_fx_downlifter', name: 'FX Downlifter',  category: 'downlifters', subcategory: 'down',   tags: ['downlifter','fall'],        gen: genFxDownlifter },
  { id: 'proc_fx_sweep',      name: 'FX Sweep Up',    category: 'sweeps',      subcategory: 'sweep',  tags: ['sweep','up','filter'],      gen: genFxSweepUp },
  { id: 'proc_fx_vinyl',      name: 'FX Vinyl Stop',  category: 'vinyl',       subcategory: 'vinyl',  tags: ['vinyl','stop','pitch'],     gen: genFxVinylStop },
  { id: 'proc_fx_crowd',      name: 'FX Crowd Cheer', category: 'crowd',       subcategory: 'crowd',  tags: ['crowd','cheer','atmos'],    gen: genFxCrowdCheer },
  { id: 'proc_fx_noise_hit',  name: 'FX Noise Hit',   category: 'noise',       subcategory: 'noise',  tags: ['noise','hit','white'],      gen: genFxWhiteNoiseHit },
  { id: 'proc_fx_sub_drop',   name: 'FX Sub Drop',    category: 'bass-drops',  subcategory: 'drop',   tags: ['sub','drop','bass'],        gen: genFxSubBassDrop },
  // Bass / 808s
  { id: 'proc_bass_808_c',    name: 'Bass 808 C2',    category: '808s',        subcategory: '808',    tags: ['808','bass','c2'],          gen: genBass808C },
  { id: 'proc_bass_sub',      name: 'Bass Sub Hit',   category: 'sub-hits',    subcategory: 'sub',    tags: ['sub','bass','hit'],         gen: genBassSubHit },
  { id: 'proc_bass_stab',     name: 'Bass Stab',      category: 'bass-drops',  subcategory: 'stab',   tags: ['bass','stab','short'],      gen: genBassStab },
  // Melodic
  { id: 'proc_synth_stab',    name: 'Synth Stab C4',  category: 'synth-shots', subcategory: 'stab',   tags: ['synth','stab','c4'],        gen: genSynthStabC4 },
  { id: 'proc_synth_lead',    name: 'Synth Lead C4',  category: 'synth-shots', subcategory: 'lead',   tags: ['synth','lead','c4'],        gen: genSynthLeadC4 },
  { id: 'proc_synth_chord',   name: 'Synth Chord C',  category: 'synth-shots', subcategory: 'chord',  tags: ['synth','chord','cmaj'],     gen: genSynthChord },
  { id: 'proc_piano_c4',      name: 'Piano C4',       category: 'piano-shots', subcategory: 'piano',  tags: ['piano','c4','acoustic'],    gen: genPianoC4 },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateAllSounds(audioCtx: AudioContext): Promise<ProceduralSound[]> {
  const sr = audioCtx.sampleRate;

  // Parallelise all generators
  const buffers = await Promise.all(PROCEDURAL_CATALOG.map((s) => s.gen(sr)));

  return PROCEDURAL_CATALOG.map((spec, i) => ({
    id: spec.id,
    name: spec.name,
    category: spec.category,
    subcategory: spec.subcategory,
    buffer: buffers[i]!,
    duration: buffers[i]!.duration,
    tags: spec.tags,
  }));
}
