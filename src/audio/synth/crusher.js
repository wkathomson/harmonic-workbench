/* bitcrusher worklet source, loaded once before the synth is constructed */
export const CRUSHER_SRC = `
  class BitCrusher extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        { name: 'bits', defaultValue: 16, minValue: 1, maxValue: 16 },
        { name: 'reduction', defaultValue: 1, minValue: 1, maxValue: 64 }
      ];
    }
    constructor() {
      super();
      this.phase = [0, 0];
      this.hold = [0, 0];
    }
    process(inputs, outputs, parameters) {
      const input = inputs[0], output = outputs[0];
      if (!output.length) return true;
      for (let ch = 0; ch < output.length; ch++) {
        const inp = (input[ch] || input[0]);
        const out = output[ch];
        if (!inp) { out.fill(0); continue; }
        for (let i = 0; i < out.length; i++) {
          const bits = parameters.bits.length > 1 ? parameters.bits[i] : parameters.bits[0];
          const red = parameters.reduction.length > 1 ? parameters.reduction[i] : parameters.reduction[0];
          this.phase[ch] += 1;
          if (this.phase[ch] >= red) {
            this.phase[ch] -= red;
            const steps = Math.pow(2, bits - 1);
            this.hold[ch] = Math.round(inp[i] * steps) / steps;
          }
          out[i] = this.hold[ch];
        }
      }
      return true;
    }
  }
  registerProcessor('bit-crusher', BitCrusher);
`;   // step rate of the S&H buffer at playbackRate 1

export async function loadCrusher(ctx) {
  if (!ctx.audioWorklet) return false;
  try {
    const url = URL.createObjectURL(new Blob([CRUSHER_SRC], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    return true;
  } catch { return false; }
}
