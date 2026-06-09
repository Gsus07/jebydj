import { audioEngine } from '@/src/lib/audio/AudioEngine';

export interface EQBand {
  type: BiquadFilterType;
  frequency: number;
  gain: number;
  Q: number;
  enabled: boolean;
}

export class ParametricEQProcessor {
  private _ctx: AudioContext;
  private _input: GainNode;
  private _output: GainNode;

  private _filters: BiquadFilterNode[] = [];
  
  // 7 Band EQ (Fruity Parametric EQ 2 style)
  public bands: EQBand[] = [
    { type: 'highpass', frequency: 60, gain: 0, Q: 1, enabled: true },      // Band 1: Sub cut
    { type: 'peaking', frequency: 200, gain: 0, Q: 1, enabled: true },     // Band 2: Bass
    { type: 'peaking', frequency: 500, gain: 0, Q: 1, enabled: true },     // Band 3: Low Mid
    { type: 'peaking', frequency: 1200, gain: 0, Q: 1, enabled: true },    // Band 4: Mid
    { type: 'peaking', frequency: 3000, gain: 0, Q: 1, enabled: true },    // Band 5: High Mid
    { type: 'peaking', frequency: 6000, gain: 0, Q: 1, enabled: true },    // Band 6: Treble
    { type: 'lowpass', frequency: 15000, gain: 0, Q: 1, enabled: true },   // Band 7: Air cut
  ];

  // Visualizer
  private _analyzer: AnalyserNode;
  
  constructor() {
    this._ctx = audioEngine.ctx;
    this._input = this._ctx.createGain();
    this._output = this._ctx.createGain();

    this._analyzer = this._ctx.createAnalyser();
    this._analyzer.fftSize = 2048;
    this._analyzer.smoothingTimeConstant = 0.8;

    this._buildChain();
  }

  private _buildChain() {
    // Disconnect old
    this._input.disconnect();
    this._filters.forEach(f => f.disconnect());
    this._filters = [];

    // Create filters
    this.bands.forEach(b => {
      const f = this._ctx.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.frequency;
      f.gain.value = b.gain;
      f.Q.value = b.Q;
      this._filters.push(f);
    });

    // Route: Input -> Analyzer -> Filter 1 -> ... -> Filter 7 -> Output
    this._input.connect(this._analyzer);
    
    let current: AudioNode = this._input;
    for (let i = 0; i < 7; i++) {
      if (this.bands[i].enabled) {
        current.connect(this._filters[i]);
        current = this._filters[i];
      }
    }
    
    current.connect(this._output);
  }

  setBandParam(index: number, param: keyof EQBand, value: any) {
    if (index < 0 || index >= 7) return;
    
    (this.bands[index] as any)[param] = value;
    
    if (param === 'enabled' || param === 'type') {
      this._buildChain(); // Rebuild for type/routing changes
    } else {
      // Update inline
      const filter = this._filters[index];
      if (param === 'frequency') filter.frequency.value = value;
      else if (param === 'gain') filter.gain.value = value;
      else if (param === 'Q') filter.Q.value = value;
    }
  }

  getFrequencyData(array: Uint8Array) {
    this._analyzer.getByteFrequencyData(array as any);
  }

  // Get frequency response curve for drawing
  getFrequencyResponse(freqs: Float32Array, magResponse: Float32Array, phaseResponse: Float32Array) {
    // We combine the response of all enabled filters
    const tempMag = new Float32Array(freqs.length);
    const tempPhase = new Float32Array(freqs.length);
    
    magResponse.fill(1.0); // start at 1.0 (0dB)
    
    for (let i = 0; i < 7; i++) {
      if (this.bands[i].enabled) {
        this._filters[i].getFrequencyResponse(freqs as any, tempMag as any, tempPhase as any);
        for (let j = 0; j < freqs.length; j++) {
          magResponse[j] *= tempMag[j];
        }
      }
    }
  }

  getInput(): AudioNode { return this._input; }
  getOutput(): AudioNode { return this._output; }

  dispose() {
    this._filters.forEach(f => { try { f.disconnect(); } catch {} });
    try { this._input.disconnect(); this._output.disconnect(); this._analyzer.disconnect(); } catch {}
  }
}
