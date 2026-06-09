import { audioEngine } from '@/src/lib/audio/AudioEngine';

export class PeakControllerProcessor {
  private _ctx: AudioContext;
  private _input: GainNode;
  private _output: GainNode;

  // LFO
  private _lfo: OscillatorNode;
  private _lfoGain: GainNode;
  
  // Peak follower
  private _analyzer: AnalyserNode;
  private _peakData: Float32Array;
  
  // Base/Vol/Tension for Peak
  public base = 0.5; // 0-1
  public volume = 0.5; // 0-1
  public tension = 0.5; // 0-1 (curve shape)

  constructor() {
    this._ctx = audioEngine.ctx;
    this._input = this._ctx.createGain();
    this._output = this._ctx.createGain();

    // Signal passes through unaffected (mostly used as a controller)
    this._input.connect(this._output);

    // Peak Follower
    this._analyzer = this._ctx.createAnalyser();
    this._analyzer.fftSize = 512;
    this._analyzer.smoothingTimeConstant = 0.8;
    this._input.connect(this._analyzer);
    this._peakData = new Float32Array(this._analyzer.frequencyBinCount);

    // LFO
    this._lfo = this._ctx.createOscillator();
    this._lfo.type = 'sine';
    this._lfo.frequency.value = 2; // 2 Hz default
    this._lfoGain = this._ctx.createGain();
    this._lfoGain.gain.value = 0.5;
    
    this._lfo.connect(this._lfoGain);
    this._lfo.start();
  }

  // Gets the current peak/lfo values (0 to 1) for the UI or for modulating other parameters
  getControlValues() {
    this._analyzer.getFloatTimeDomainData(this._peakData);
    
    // Calculate RMS / Peak
    let peak = 0;
    for (let i = 0; i < this._peakData.length; i++) {
      const val = Math.abs(this._peakData[i]);
      if (val > peak) peak = val;
    }
    
    // Apply tension curve (simplified)
    if (this.tension !== 0.5) {
      const curve = this.tension > 0.5 ? this.tension * 2 : (1 / (1.001 - this.tension * 2));
      peak = Math.pow(peak, curve);
    }
    
    // Scale and shift
    const peakOut = Math.min(1, Math.max(0, this.base + peak * (this.volume * 2 - 1)));
    
    // In a real PeakController, the LFO is added to the Peak out, or output separately
    return {
      peak: peakOut,
      rawPeak: peak,
    };
  }
  
  setParam(name: string, value: number) {
    if (name === 'base') this.base = value;
    else if (name === 'volume') this.volume = value;
    else if (name === 'tension') this.tension = value;
    else if (name === 'lfoShape') {
      const shapes: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];
      this._lfo.type = shapes[Math.floor(value)];
    }
    else if (name === 'lfoSpeed') this._lfo.frequency.value = value;
    else if (name === 'lfoAmount') this._lfoGain.gain.value = value;
  }

  getInput(): AudioNode { return this._input; }
  getOutput(): AudioNode { return this._output; }

  dispose() {
    try { this._lfo.stop(); this._lfo.disconnect(); } catch {}
    try { this._input.disconnect(); this._output.disconnect(); } catch {}
  }
}
