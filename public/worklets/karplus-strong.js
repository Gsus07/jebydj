// Karplus-Strong AudioWorkletProcessor

class KarplusStrongProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(48000); // Max delay buffer (1 sec at 48k)
    this.bufferIndex = 0;
    this.bufferLength = 0;
    this.decay = 0.99;
    this.initialized = false;
  }

  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 440, minValue: 20, maxValue: 20000 },
      { name: 'decay', defaultValue: 0.99, minValue: 0.8, maxValue: 0.9999 },
      { name: 'trigger', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];
    const freq = parameters.frequency.length > 1 ? parameters.frequency[0] : parameters.frequency[0];
    const trigger = parameters.trigger.length > 1 ? parameters.trigger[0] : parameters.trigger[0];
    const decayParam = parameters.decay.length > 1 ? parameters.decay[0] : parameters.decay[0];

    // Recalculate buffer length based on frequency
    this.bufferLength = Math.max(1, Math.floor(sampleRate / freq));

    // Handle trigger
    if (trigger > 0.5 && !this.initialized) {
      // Excite with noise
      for (let i = 0; i < this.bufferLength; i++) {
        this.buffer[i] = (Math.random() * 2 - 1);
      }
      this.bufferIndex = 0;
      this.initialized = true;
    } else if (trigger <= 0.5) {
      this.initialized = false;
    }

    // Process synthesis
    for (let i = 0; i < channel.length; i++) {
      const currentIdx = this.bufferIndex % this.bufferLength;
      const nextIdx = (this.bufferIndex + 1) % this.bufferLength;

      // Lowpass average
      const avg = (this.buffer[currentIdx] + this.buffer[nextIdx]) * 0.5;
      
      // Decay
      this.buffer[currentIdx] = avg * decayParam;
      
      // Output
      channel[i] = this.buffer[currentIdx];
      this.bufferIndex++;
    }

    // Copy to other channels
    for (let c = 1; c < output.length; c++) {
      output[c].set(channel);
    }

    return true;
  }
}

registerProcessor('karplus-strong', KarplusStrongProcessor);
