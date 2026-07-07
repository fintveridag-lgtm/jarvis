let ctx = null;
let analyser = null;
let sourceNode = null;
let timeData = null;
let freqData = null;

// createMediaElementSource can only be called once per <audio> element,
// so this guards against re-initializing on repeated brief runs.
export function ensureAnalyser(audioEl) {
  if (analyser) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = ctx.createMediaElementSource(audioEl);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  sourceNode.connect(analyser);
  analyser.connect(ctx.destination);
  timeData = new Uint8Array(analyser.fftSize);
  freqData = new Uint8Array(analyser.frequencyBinCount);
}

export function resumeAudioContext() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function getAudioLevels() {
  if (!analyser) return { level: 0, bass: 0, treble: 0 };

  analyser.getByteTimeDomainData(timeData);
  let sumSquares = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sumSquares += v * v;
  }
  const rms = Math.sqrt(sumSquares / timeData.length);

  analyser.getByteFrequencyData(freqData);
  const bassEnd = Math.max(1, Math.floor(freqData.length * 0.15));
  const trebleStart = Math.floor(freqData.length * 0.5);
  let bassSum = 0;
  let trebleSum = 0;
  for (let i = 0; i < bassEnd; i++) bassSum += freqData[i];
  for (let i = trebleStart; i < freqData.length; i++) trebleSum += freqData[i];
  const bass = bassSum / (bassEnd * 255);
  const treble = trebleSum / ((freqData.length - trebleStart || 1) * 255);

  return { level: rms, bass, treble };
}
