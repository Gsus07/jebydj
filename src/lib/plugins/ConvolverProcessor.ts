import { audioEngine } from '@/src/lib/audio/AudioEngine';

export class ConvolverProcessor {
  private _ctx: AudioContext;
  private _input: GainNode;
  private _output: GainNode;
  
  private _convolver: ConvolverNode;
  private _dryGain: GainNode;
  private _wetGain: GainNode;

  // EQ Pre-Convolver
  private _eqLow: BiquadFilterNode;
  private _eqHigh: BiquadFilterNode;

  constructor() {
    this._ctx = audioEngine.ctx;
    this._input = this._ctx.createGain();
    this._output = this._ctx.createGain();

    this._convolver = this._ctx.createConvolver();
    this._dryGain = this._ctx.createGain();
    this._wetGain = this._ctx.createGain();

    this._eqLow = this._ctx.createBiquadFilter();
    this._eqLow.type = 'lowshelf';
    this._eqLow.frequency.value = 200;

    this._eqHigh = this._ctx.createBiquadFilter();
    this._eqHigh.type = 'highshelf';
    this._eqHigh.frequency.value = 4000;

    // Routing
    // Input -> Dry -> Output
    this._input.connect(this._dryGain);
    this._dryGain.connect(this._output);

    // Input -> EQ -> Convolver -> Wet -> Output
    this._input.connect(this._eqLow);
    this._eqLow.connect(this._eqHigh);
    this._eqHigh.connect(this._convolver);
    this._convolver.connect(this._wetGain);
    this._wetGain.connect(this._output);

    // Default Mix
    this._dryGain.gain.value = 1.0;
    this._wetGain.gain.value = 0.5;

    // Generate a default impulse response
    this._generateDefaultIR(2.0, 0.5); // 2s decay, 0.5 damping
  }

  // Generates a simple exponential decay white noise impulse response
  private async _generateDefaultIR(duration: number, damping: number) {
    const sampleRate = this._ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this._ctx.createBuffer(2, length, sampleRate);

    for (let c = 0; c < 2; c++) {
      const channelData = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        // White noise
        const noise = Math.random() * 2 - 1;
        // Exponential decay
        const t = i / sampleRate;
        const decay = Math.exp(-t * 3 * (1 / duration));
        
        // Simple damping (highpass filtering approximation)
        // More damping = faster decay of high frequencies
        channelData[i] = noise * decay;
      }
    }
    
    // Apply actual lowpass filter for damping using OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const src = offlineCtx.createBufferSource();
    src.buffer = impulse;
    
    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 10000 * (1 - damping) + 500; // Damping 0=10.5kHz, 1=500Hz
    
    src.connect(lp);
    lp.connect(offlineCtx.destination);
    src.start();
    
    const filteredIR = await offlineCtx.startRendering();
    this._convolver.buffer = filteredIR;
  }

  // Set custom IR from an AudioBuffer (e.g., loaded sample)
  setImpulseResponse(buffer: AudioBuffer) {
    this._convolver.buffer = buffer;
  }

  setParam(name: string, value: number) {
    if (name === 'dry') this._dryGain.gain.value = value;
    else if (name === 'wet') this._wetGain.gain.value = value;
    else if (name === 'eqLow') this._eqLow.gain.value = value; // dB -12 to 12
    else if (name === 'eqHigh') this._eqHigh.gain.value = value; // dB -12 to 12
  }

  getInput(): AudioNode { return this._input; }
  getOutput(): AudioNode { return this._output; }

  dispose() {
    try { this._input.disconnect(); this._output.disconnect(); } catch {}
  }
}
