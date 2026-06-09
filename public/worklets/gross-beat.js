// GrossBeat AudioWorkletProcessor

class GrossBeatProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 2 measure buffer at 48kHz and 60 BPM = 4 seconds = 192000 samples. 
    // We'll use 400000 samples to be safe for lower BPMs
    this.bufferSize = 400000;
    this.ringBuffer = [];
    this.writePointer = 0;
    this.initialized = false;
    this.bpm = 120;
    
    // Time and Volume arrays (100 points each)
    this.timeCurve = new Float32Array(100).fill(1.0); // 1.0 = normal time, 0 = freeze, < 1 = slow
    this.volumeCurve = new Float32Array(100).fill(1.0);
    
    // Port to receive curve data
    this.port.onmessage = (event) => {
      if (event.data.timeCurve) {
        this.timeCurve.set(event.data.timeCurve);
      }
      if (event.data.volumeCurve) {
        this.volumeCurve.set(event.data.volumeCurve);
      }
      if (event.data.bpm) {
        this.bpm = event.data.bpm;
      }
    };
  }

  static get parameterDescriptors() {
    return [
      { name: 'playhead', defaultValue: 0, minValue: 0, maxValue: 1 }, // 0 to 1 position in the 1-bar loop
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    
    const numChannels = input.length;
    if (!this.initialized) {
      for (let c = 0; c < numChannels; c++) {
        this.ringBuffer.push(new Float32Array(this.bufferSize));
      }
      this.initialized = true;
    }

    const playheadParams = parameters.playhead;
    
    for (let i = 0; i < input[0].length; i++) {
      const playhead = playheadParams.length > 1 ? playheadParams[i] : playheadParams[0];
      
      // Map playhead (0-1) to curve index (0-99)
      const curveIndex = Math.min(99, Math.max(0, Math.floor(playhead * 100)));
      
      // Calculate how many samples is 1 bar
      const samplesPerBar = (240 / this.bpm) * sampleRate;
      
      // timeCurve value: 1.0 = current write head, 0.0 = start of the bar (max delay)
      // Actually, standard grossbeat maps Y axis to time offset.
      // Y=1 (top) is normal time (delay=0). Y=0 (bottom) is -1 bar offset (delay=1 bar)
      const timeVal = this.timeCurve[curveIndex];
      const delaySamples = (1.0 - timeVal) * samplesPerBar;
      
      let readPointer = this.writePointer - delaySamples;
      if (readPointer < 0) readPointer += this.bufferSize;
      
      const idx1 = Math.floor(readPointer) % this.bufferSize;
      const idx2 = (idx1 + 1) % this.bufferSize;
      const frac = readPointer - Math.floor(readPointer);
      
      const volVal = this.volumeCurve[curveIndex];

      for (let c = 0; c < numChannels; c++) {
        // Write to ring buffer
        this.ringBuffer[c][this.writePointer] = input[c][i];
        
        // Read with linear interpolation
        const val1 = this.ringBuffer[c][idx1];
        const val2 = this.ringBuffer[c][idx2];
        const interpolated = val1 + frac * (val2 - val1);
        
        output[c][i] = interpolated * volVal;
      }
      
      this.writePointer = (this.writePointer + 1) % this.bufferSize;
    }

    return true;
  }
}

registerProcessor('gross-beat', GrossBeatProcessor);
