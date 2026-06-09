import { audioEngine } from '@/src/lib/audio/AudioEngine';

export class GrossBeatProcessor {
  private _ctx: AudioContext;
  private _input: GainNode;
  private _output: GainNode;
  private _node: AudioWorkletNode | null = null;
  
  // Dummy oscillator to drive the playhead param (0 to 1 over 1 bar)
  private _playheadOsc: OscillatorNode | null = null;

  constructor() {
    this._ctx = audioEngine.ctx;
    this._input = this._ctx.createGain();
    this._output = this._ctx.createGain();

    this._initWorklet();
  }

  private async _initWorklet() {
    try {
      await this._ctx.audioWorklet.addModule('/worklets/gross-beat.js');
    } catch (e) {
      // Might already be added or fail
    }
    
    try {
      this._node = new AudioWorkletNode(this._ctx, 'gross-beat', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 2,
      });

      this._input.connect(this._node);
      this._node.connect(this._output);
      
      // Start the playhead driver
      this._startPlayhead(120);
    } catch (e) {
      console.error('GrossBeat failed to load', e);
      // fallback bypass
      this._input.connect(this._output);
    }
  }

  private _startPlayhead(bpm: number) {
    if (this._playheadOsc) {
      this._playheadOsc.stop();
      this._playheadOsc.disconnect();
    }
    if (!this._node) return;

    // 1 bar duration in seconds (4 beats)
    const barDuration = (60 / bpm) * 4;
    const freq = 1 / barDuration;

    // Create a saw wave that goes from 0 to 1.
    // Standard saw goes 1 to -1. We need 0 to 1.
    this._playheadOsc = this._ctx.createOscillator();
    this._playheadOsc.type = 'sawtooth';
    this._playheadOsc.frequency.value = freq;
    
    // Scale and shift: saw is 1 to -1.
    // We want 0 to 1. 
    // Multiply by -0.5 -> -0.5 to 0.5. Add 0.5 -> 0 to 1.
    const gain = this._ctx.createGain();
    gain.gain.value = -0.5;
    
    // DC offset
    const dc = this._ctx.createBufferSource();
    const dcBuf = this._ctx.createBuffer(1, 1, this._ctx.sampleRate);
    dcBuf.getChannelData(0)[0] = 1.0;
    dc.buffer = dcBuf;
    dc.loop = true;
    const dcGain = this._ctx.createGain();
    dcGain.gain.value = 0.5;
    dc.connect(dcGain);
    dc.start();
    
    this._playheadOsc.connect(gain);
    gain.connect(this._node.parameters.get('playhead')!);
    dcGain.connect(this._node.parameters.get('playhead')!);
    
    this._playheadOsc.start();
  }

  updateCurves(timeCurve: Float32Array, volumeCurve: Float32Array, bpm: number) {
    if (this._node) {
      this._node.port.postMessage({ timeCurve, volumeCurve, bpm });
      this._startPlayhead(bpm);
    }
  }

  getInput(): AudioNode { return this._input; }
  getOutput(): AudioNode { return this._output; }

  dispose() {
    if (this._playheadOsc) {
      try { this._playheadOsc.stop(); this._playheadOsc.disconnect(); } catch {}
    }
    if (this._node) {
      try { this._node.disconnect(); } catch {}
    }
    try { this._input.disconnect(); this._output.disconnect(); } catch {}
  }
}
