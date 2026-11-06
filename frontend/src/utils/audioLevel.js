/**
 * Live input level of a microphone stream, 0..1, sampled ~20 times a second.
 * Returns a function that stops the meter. The stream's tracks are not
 * stopped; whoever opened the stream owns them.
 */
export function createLevelMeter(stream, onLevel, { intervalMs = 50 } = {}) {
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx || !stream || stream.getAudioTracks().length === 0) return () => {};

  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // Normal speech is roughly 0.03-0.2 RMS; scale so it fills the meter
    onLevel(Math.min(1, rms * 5));
  }, intervalMs);

  return () => {
    clearInterval(timer);
    try { source.disconnect(); } catch (_) { /* ignore */ }
    ctx.close().catch(() => {});
  };
}

/** Level above which we treat the input as sound (not silence) */
export const SOUND_THRESHOLD = 0.06;
