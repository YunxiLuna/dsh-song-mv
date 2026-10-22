// Pure-JS audio analysis: WAV -> feature JSON aligned to the video frame grid.
// No Python, no native deps. Uses only Node's fs plus an in-file radix-2 FFT.
//
// Frame i is centred at t = i / fps seconds.
// Everything downstream (scenes, lyric effects, camera) reads this JSON only.

const N_FFT = 2048;
const N_BANDS = 32;
const BANDS_HZ = { low: [20, 150], mid: [150, 2500], high: [2500, 16000] };

// ---------------------------------------------------------------- WAV reader
export function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    off = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('missing fmt/data chunk');
  const { channels, sampleRate, bits } = fmt;
  const n = Math.floor(data.length / (channels * (bits / 8)));
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const p = (i * channels + c) * (bits / 8);
      acc += bits === 16 ? data.readInt16LE(p) / 32768 : bits === 32 ? data.readFloatLE(p)
        : bits === 24 ? (data.readUInt8(p) | (data.readUInt8(p + 1) << 8) | (data.readInt8(p + 2) << 16)) / 8388608
        : data.readUInt8(p) / 128 - 1;
    }
    mono[i] = acc / channels;
  }
  return { sampleRate, channels, bits, samples: mono, duration: n / sampleRate };
}

// ---------------------------------------------------------------- FFT
function makeFFT(n) {
  const levels = Math.log2(n) | 0;
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i, r = 0;
    for (let j = 0; j < levels; j++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r;
  }
  return function fft(re, im) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const c = cos[k], s = sin[k];
          const a = i + j, b = a + half;
          const tr = re[b] * c + im[b] * s;
          const ti = im[b] * c - re[b] * s;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
  };
}

function hann(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

// ---------------------------------------------------------------- helpers
function percentile(arr, pct) {
  const a = Float64Array.from(arr).sort();
  const i = Math.min(a.length - 1, Math.max(0, Math.round((pct / 100) * (a.length - 1))));
  return a[i] || 1e-9;
}
function norm01(arr, pct = 99.5) {
  const ref = percentile(arr, pct) || 1;
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = Math.max(0, Math.min(1, arr[i] / ref));
  return out;
}
const r3 = (x) => Math.round(x * 1000) / 1000;
const arr3 = (a) => Array.from(a, r3);

function mel(f) { return 2595 * Math.log10(1 + f / 700); }
function imel(m) { return 700 * (Math.pow(10, m / 2595) - 1); }

function melFilterbank(sampleRate, nFft, nBands, fmin, fmax) {
  const lo = mel(fmin), hi = mel(fmax);
  const pts = []; // centre frequencies
  for (let i = 0; i < nBands + 2; i++) pts.push(imel(lo + ((hi - lo) * i) / (nBands + 1)));
  const binHz = sampleRate / nFft;
  const bins = pts.map((f) => Math.floor(f / binHz));
  const filters = [];
  for (let b = 0; b < nBands; b++) {
    const [l, c, r] = [bins[b], bins[b + 1], bins[b + 2]];
    const w = new Float64Array(Math.max(1, r - l + 1));
    for (let k = l; k <= r; k++) {
      const v = k <= c ? (k - l) / Math.max(1, c - l) : (r - k) / Math.max(1, r - c);
      w[k - l] = Math.max(0, v);
    }
    filters.push({ start: l, weights: w });
  }
  return filters;
}

// ---------------------------------------------------------------- main
export function analyze(samples, sampleRate, { fps = 60, onProgress = null, bpm: bpmOverride = null } = {}) {
  const hop = sampleRate / fps;
  if (!Number.isInteger(hop)) {
    throw new Error(`sample rate ${sampleRate} is not divisible by fps ${fps}; resample to a multiple first`);
  }
  const nFrames = Math.ceil(samples.length / hop);
  const fft = makeFFT(N_FFT);
  const win = hann(N_FFT);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  const half = N_FFT / 2 + 1;
  const binHz = sampleRate / N_FFT;
  const freqs = new Float64Array(half);
  for (let k = 0; k < half; k++) freqs[k] = k * binHz;

  const bandIdx = {};
  for (const [name, [lo, hi]] of Object.entries(BANDS_HZ)) {
    const sel = [];
    for (let k = 0; k < half; k++) if (freqs[k] >= lo && freqs[k] < hi) sel.push(k);
    bandIdx[name] = sel;
  }
  const filters = melFilterbank(sampleRate, N_FFT, N_BANDS, 30, 16000);

  const power = new Float64Array(nFrames * half);
  const rms = new Float64Array(nFrames);
  const bands = { low: new Float64Array(nFrames), mid: new Float64Array(nFrames), high: new Float64Array(nFrames) };

  for (let i = 0; i < nFrames; i++) {
    // Frame i is centred on sample i*hop.
    const centre = i * hop;
    const start = centre - N_FFT / 2;
    for (let k = 0; k < N_FFT; k++) {
      const p = start + k;
      re[k] = p >= 0 && p < samples.length ? samples[p] * win[k] : 0;
      im[k] = 0;
    }
    fft(re, im);

    let acc = 0;
    for (let k = 0; k < half; k++) {
      const pw = re[k] * re[k] + im[k] * im[k];
      power[i * half + k] = pw;
      if (k > 0 && k < half - 1) acc += pw;
    }
    rms[i] = Math.sqrt(acc / (half - 2));
    for (const name of ['low', 'mid', 'high']) {
      let s = 0;
      for (const k of bandIdx[name]) s += power[i * half + k];
      bands[name][i] = Math.sqrt(s);
    }
    if (onProgress && i % 2000 === 0) onProgress(i / nFrames);
  }

  // ---- mel spectrum -> uint8 rows (dB relative to global max, 70 dB floor)
  let melMax = 1e-12;
  const melDb = new Float64Array(nFrames * N_BANDS);
  for (let i = 0; i < nFrames; i++) {
    for (let b = 0; b < N_BANDS; b++) {
      const f = filters[b];
      let s = 0;
      for (let k = 0; k < f.weights.length; k++) {
        const w = f.weights[k];
        if (w !== 0) s += power[i * half + f.start + k] * w;
      }
      const db = 10 * Math.log10(s + 1e-12);
      melDb[i * N_BANDS + b] = db;
      if (db > melMax) melMax = db;
    }
  }
  const spectrum = new Uint8Array(nFrames * N_BANDS);
  for (let i = 0; i < melDb.length; i++) {
    const rel = Math.max(-70, melDb[i] - melMax);
    spectrum[i] = Math.max(0, Math.min(255, Math.round(((rel + 70) / 70) * 255)));
  }

  // ---- onset envelope on a finer hop (256 samples)
  const hopB = 256;
  const bFrames = Math.ceil(samples.length / hopB);
  const flux = new Float64Array(bFrames);
  const prev = new Float64Array(N_BANDS);
  for (let i = 0; i < bFrames; i++) {
    const centre = i * hopB;
    const start = centre - N_FFT / 2;
    for (let k = 0; k < N_FFT; k++) {
      const p = start + k;
      re[k] = p >= 0 && p < samples.length ? samples[p] * win[k] : 0;
      im[k] = 0;
    }
    fft(re, im);
    let s = 0;
    for (let b = 0; b < N_BANDS; b++) {
      const f = filters[b];
      let acc = 0;
      for (let k = 0; k < f.weights.length; k++) {
        const w = f.weights[k];
        if (w !== 0) acc += (re[f.start + k] * re[f.start + k] + im[f.start + k] * im[f.start + k]) * w;
      }
      const v = Math.log10(1 + 1000 * acc);
      const d = v - prev[b];
      if (d > 0) s += d;
      prev[b] = v;
    }
    flux[i] = s;
  }
  // smooth
  const env = new Float64Array(bFrames);
  for (let i = 0; i < bFrames; i++) {
    const a = flux[Math.max(0, i - 1)], b = flux[i], c = flux[Math.min(bFrames - 1, i + 1)];
    env[i] = (a + 2 * b + c) / 4;
  }

  // ---- tempo: autocorrelation peaks -> harmonic candidates -> grid-energy vote
  const envMean = env.reduce((a, b) => a + b, 0) / env.length;
  const centred = Float64Array.from(env, (v) => v - envMean);
  const minLag = Math.floor((60 / 200) * (sampleRate / hopB));
  const maxLag = Math.ceil((60 / 50) * (sampleRate / hopB));
  const lagBpm = (lag) => (60 * sampleRate) / (lag * hopB);
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i + lag < centred.length; i++) acc += centred[i] * centred[i + lag];
    ac[lag] = acc / (centred.length - lag);
  }
  const peaks = [];
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1]) peaks.push({ lag, score: ac[lag], bpm: lagBpm(lag) });
  }
  peaks.sort((a, b) => b.score - a.score);
  const bpmSeed = peaks.length ? peaks[0].bpm : 110;

  const dur = samples.length / sampleRate;
  const tOf = (i) => (i * hopB) / sampleRate;
  const envAt = (t) => {
    const x = (t * sampleRate) / hopB;
    const i = Math.floor(x);
    if (i < 0 || i >= env.length - 1) return 0;
    const k = x - i;
    return env[i] * (1 - k) + env[i + 1] * k;
  };

  // A tempo grid is good when its pulses land on energetic onsets. Mean (not sum)
  // keeps slow and fast grids comparable; the harmonic family around the strongest
  // autocorrelation peak covers the usual octave / three-against-two confusion.
  function scoreGrid(bpm) {
    const per = 60 / bpm;
    if (per <= 0.2 || per >= 2.5) return { score: -1 };
    let bestS = -1, bestPh = 0;
    const steps = Math.max(8, Math.round(per / 0.004));
    for (let s = 0; s < steps; s++) {
      const ph = (s * per) / steps;
      let acc = 0, n = 0;
      for (let t = ph; t < dur; t += per) { acc += envAt(t); n++; }
      const sc = n ? acc / n : 0;
      if (sc > bestS) { bestS = sc; bestPh = ph; }
    }
    return { score: bestS, t0: bestPh };
  }

  const cands = new Set();
  for (const p of peaks.slice(0, 6)) {
    for (const mul of [1, 2, 4 / 3, 3 / 4, 3 / 2, 2 / 3, 1 / 2]) {
      const b = p.bpm * mul;
      if (b >= 55 && b <= 190) cands.add(Math.round(b * 100) / 100);
    }
  }
  for (let b = Math.round(bpmSeed) - 1; b <= Math.round(bpmSeed) + 1; b += 0.02) {
    if (b >= 55 && b <= 190) cands.add(Math.round(b * 100) / 100);
  }
  let best = { score: -1, bpm: bpmSeed, t0: 0 };
  const candScores = [];
  for (const bpm of cands) {
    const g = scoreGrid(bpm);
    candScores.push({ bpm, score: Math.round(g.score * 1000) / 1000 });
    if (g.score > best.score) best = { score: g.score, bpm, t0: g.t0 };
  }
  candScores.sort((a, b) => b.score - a.score);
  // Refine around the winner at 4 mBPM resolution.
  const seedBpm = best.bpm;
  for (let bpm = seedBpm - 0.6; bpm <= seedBpm + 0.6; bpm += 0.004) {
    const g = scoreGrid(bpm);
    if (g.score > best.score + 1e-9) best = { score: g.score, bpm, t0: g.t0 };
  }
  // A caller who knows the real tempo (a DAW, a score, the artist's BPM) wins:
  // the grid search only ever guesses, and half/double-time is genuinely
  // ambiguous from energy alone.
  if (bpmOverride) {
    const g = scoreGrid(bpmOverride);
    best = { score: g.score, bpm: bpmOverride, t0: g.t0 };
  }
  const bpmEst = Math.round(best.bpm * 1000) / 1000;
  // Report runner-up metrical levels so the storyboard can override the pulse.
  const tempoCandidates = [];
  for (const c of candScores) {
    const b = Math.round(c.bpm * 10) / 10;
    if (tempoCandidates.some((x) => Math.abs(x.bpm - b) < 0.4)) continue;
    if (Math.abs(b - bpmEst) < 0.4) continue;
    tempoCandidates.push({ bpm: b, score: c.score });
    if (tempoCandidates.length >= 4) break;
  }
  const period = 60 / best.bpm;
  const beats = [];
  for (let t = best.t0; t < dur; t += period) beats.push(t);

  // ---- onset times: local maxima of the envelope, above an adaptive threshold
  const onT = [], onS = [];
  const mean = env.reduce((a, b) => a + b, 0) / env.length;
  let std = 0;
  for (const v of env) std += (v - mean) * (v - mean);
  std = Math.sqrt(std / env.length);
  const thr = mean + 0.9 * std;
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] > thr && env[i] >= env[i - 1] && env[i] > env[i + 1]) onT.push(tOf(i)), onS.push(env[i]);
  }
  const onSNorm = norm01(onS, 98);

  // ---- downbeat: which of the 4 beat phases carries the most low-band energy
  let phase = 0, bestLo = -1;
  for (let p = 0; p < 4; p++) {
    let acc = 0, n = 0;
    for (let i = p; i < beats.length; i += 4) {
      const fi = Math.min(nFrames - 1, Math.max(0, Math.round(beats[i] * fps)));
      acc += bands.low[fi]; n++;
    }
    const m = n ? acc / n : 0;
    if (m > bestLo) { bestLo = m; phase = p; }
  }

  return {
    meta: {
      sampleRate, fps, frames: nFrames, nFft: N_FFT,
      bandsHz: BANDS_HZ, spectrumBands: N_BANDS, duration: Math.round(dur * 10000) / 10000,
      hop, hopOnset: hopB,
    },
    bpm: bpmEst,
    bpmEstimate: bpmEst,
    grid: { bpm: bpmEst, t0: Math.round(best.t0 * 10000) / 10000, period: Math.round(period * 1e6) / 1e6, gridEnergy: Math.round(best.score * 1000) / 1000 },
    tempoCandidates,
    downbeatPhase: phase,
    beats: arr3(beats),
    onsets: { t: arr3(onT), s: arr3(onSNorm) },
    rms: arr3(norm01(rms)),
    low: arr3(norm01(bands.low)),
    mid: arr3(norm01(bands.mid)),
    high: arr3(norm01(bands.high)),
    spectrum: Array.from(spectrum),
  };
}
