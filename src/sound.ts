// Every sound is synthesized: filtered noise bursts. Zero audio files.
let ctx: AudioContext | null = null;
let on = false;

function burst(freq: number, q: number, dur: number, gain: number) {
  if (!ctx || !on) return;
  const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
  src.connect(f).connect(g).connect(ctx.destination); src.start();
}

export const sound = {
  get on() { return on; },
  async toggle() {
    try {
      ctx ??= new AudioContext();
      await ctx.resume();
      on = !on;
      // the same gesture unlocks phone tilt where the browser allows it
      const DO = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (on && DO?.requestPermission) await DO.requestPermission().catch(() => {});
    } catch { on = false; }
    return on;
  },
  swish: () => burst(1800, 0.7, 0.18, 0.18), // fabric moving past
  click: () => burst(3200, 6, 0.05, 0.35), // a tag gun
};
