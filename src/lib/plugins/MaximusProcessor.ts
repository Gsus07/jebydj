import { audioEngine } from '@/src/lib/audio/AudioEngine';

export class MaximusProcessor {
  private _ctx: AudioContext;
  private _input: GainNode;
  private _output: GainNode;

  // Splitters
  private _split1: BiquadFilterNode; // Lowpass for LOW
  private _split1_high: BiquadFilterNode; // Highpass to pass Mid/High
  private _split2: BiquadFilterNode; // Lowpass for MID
  private _split2_high: BiquadFilterNode; // Highpass for HIGH

  // Compressors
  private _compLow: DynamicsCompressorNode;
  private _compMid: DynamicsCompressorNode;
  private _compHigh: DynamicsCompressorNode;
  private _compMaster: DynamicsCompressorNode; // Limiter

  // Gains
  private _gainLow: GainNode;
  private _gainMid: GainNode;
  private _gainHigh: GainNode;

  constructor() {
    this._ctx = audioEngine.ctx;
    this._input = this._ctx.createGain();
    this._output = this._ctx.createGain();

    // 1st split (Low vs Mid/High) at 200 Hz
    this._split1 = this._ctx.createBiquadFilter();
    this._split1.type = 'lowpass';
    this._split1.frequency.value = 200;

    this._split1_high = this._ctx.createBiquadFilter();
    this._split1_high.type = 'highpass';
    this._split1_high.frequency.value = 200;

    // 2nd split (Mid vs High) at 2000 Hz
    this._split2 = this._ctx.createBiquadFilter();
    this._split2.type = 'lowpass';
    this._split2.frequency.value = 2000;

    this._split2_high = this._ctx.createBiquadFilter();
    this._split2_high.type = 'highpass';
    this._split2_high.frequency.value = 2000;

    // Compressors
    this._compLow = this._ctx.createDynamicsCompressor();
    this._compMid = this._ctx.createDynamicsCompressor();
    this._compHigh = this._ctx.createDynamicsCompressor();
    this._compMaster = this._ctx.createDynamicsCompressor(); // Limiter

    // Default settings for compression
    const initComp = (comp: DynamicsCompressorNode) => {
      comp.threshold.value = -24;
      comp.knee.value = 30;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
    };
    initComp(this._compLow);
    initComp(this._compMid);
    initComp(this._compHigh);
    
    // Master Limiter
    this._compMaster.threshold.value = -0.5;
    this._compMaster.knee.value = 0.0;
    this._compMaster.ratio.value = 20;
    this._compMaster.attack.value = 0.001;
    this._compMaster.release.value = 0.1;

    // Gains
    this._gainLow = this._ctx.createGain();
    this._gainMid = this._ctx.createGain();
    this._gainHigh = this._ctx.createGain();

    // Routing
    this._input.connect(this._split1);
    this._input.connect(this._split1_high);

    this._split1_high.connect(this._split2);
    this._split1_high.connect(this._split2_high);

    // Low band
    this._split1.connect(this._compLow);
    this._compLow.connect(this._gainLow);
    this._gainLow.connect(this._compMaster);

    // Mid band
    this._split2.connect(this._compMid);
    this._compMid.connect(this._gainMid);
    this._gainMid.connect(this._compMaster);

    // High band
    this._split2_high.connect(this._compHigh);
    this._compHigh.connect(this._gainHigh);
    this._gainHigh.connect(this._compMaster);

    this._compMaster.connect(this._output);
  }

  setParam(band: 'low' | 'mid' | 'high' | 'master', param: string, value: number) {
    let comp: DynamicsCompressorNode;
    if (band === 'low') comp = this._compLow;
    else if (band === 'mid') comp = this._compMid;
    else if (band === 'high') comp = this._compHigh;
    else comp = this._compMaster;

    if (param === 'threshold') comp.threshold.value = value;
    else if (param === 'ratio') comp.ratio.value = value;
    else if (param === 'attack') comp.attack.value = value;
    else if (param === 'release') comp.release.value = value;
    else if (param === 'gain') {
      if (band === 'low') this._gainLow.gain.value = value;
      else if (band === 'mid') this._gainMid.gain.value = value;
      else if (band === 'high') this._gainHigh.gain.value = value;
    }
  }

  setCrossover(split: 1 | 2, freq: number) {
    if (split === 1) {
      this._split1.frequency.value = freq;
      this._split1_high.frequency.value = freq;
    } else {
      this._split2.frequency.value = freq;
      this._split2_high.frequency.value = freq;
    }
  }
  
  // Realtime readouts (reduction in dB)
  getReduction() {
    return {
      low: this._compLow.reduction,
      mid: this._compMid.reduction,
      high: this._compHigh.reduction,
      master: this._compMaster.reduction,
    };
  }

  getInput(): AudioNode { return this._input; }
  getOutput(): AudioNode { return this._output; }

  dispose() {
    try { this._input.disconnect(); this._output.disconnect(); } catch {}
  }
}
