// Looks — a colour world, not a colour scheme.
//
// The engine has eight emotional states (still, tender, build, release, intense,
// peak, dawn, fade). A *look* supplies those eight states for one visual world:
// a night office, a sheet of paper, a rainy window, a bright morning.
//
// A scene never names a colour. It reads `p.text`, `p.accent`, `p.bg` and the
// look decides what that means. So the same nine scenes can be told in six
// different worlds, and a new world is ~30 lines.
//
// Palette fields (all hex, no alpha — use hexA() for transparency):
//   bg panel raised line text sub mute accent accentHot accentDim glow sat
//   bg      the far background
//   panel   large surfaces (walls, screens, cards)
//   raised  small surfaces that sit on a panel
//   line    hairlines and strokes
//   text    primary type (lyrics)
//   sub     secondary type (captions, labels)
//   mute    tertiary type (decorative text, watermarks)
//   accent  the world's own strong colour
//   accentHot  the one that flashes on a hit
//   accentDim  a quieter accent for large fills
//   glow    bloom multiplier, 0..2 (0 = flat, no bloom)
//   sat     how saturated the whole frame is, 0..2 (0 = monochrome)

const FIELDS = ['bg', 'panel', 'raised', 'line', 'text', 'sub', 'mute', 'accent', 'accentHot', 'accentDim'];

/** Compact palette row: [bg, panel, raised, line, text, sub, mute, accent, accentHot, accentDim, glow, sat] */
function row(values) {
  const out = {};
  FIELDS.forEach((k, i) => { out[k] = values[i]; });
  out.glow = values[10];
  out.sat = values[11];
  return out;
}

const BLACK = '#000000';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mixColor(a, b, k) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg2, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * k, ag + (bg2 - ag) * k, ab + (bb - ab) * k);
}

/** Blend two palettes. `k` 0 keeps `a`, 1 keeps `b`. */
export function blendPal(a, b, k) {
  const out = {};
  for (const f of FIELDS) out[f] = mixColor(a[f], b[f], k);
  out.glow = a.glow + (b.glow - a.glow) * k;
  out.sat = a.sat + (b.sat - a.sat) * k;
  return out;
}

/**
 * A look is authored as four palettes — calm, mid, hot, dawn — and the eight
 * emotional states are interpolated from them. That keeps each world small
 * enough to tune by eye instead of by spreadsheet.
 */
function makeLook({ id, label, when, calm, mid, hot, dawn, scan = 0, grain = 0.02,
                   vignette = { color: '#000000', alpha: 0.3 } }) {
  const c = row(calm), m = row(mid), h = row(hot), d = row(dawn);
  const dead = row([BLACK, BLACK, BLACK, BLACK, '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', 0, 0]);
  return {
    id,
    label,
    when,
    scan,
    grain,
    vignette,
    states: {
      still: c,
      tender: blendPal(c, m, 0.5),
      build: blendPal(c, m, 0.8),
      release: m,
      intense: blendPal(m, h, 0.65),
      peak: h,
      dawn: d,
      fade: blendPal(c, dead, 0.55),
    },
  };
}

export const LOOKS = {
  // ---------------------------------------------------------------------------
  'night-shift': makeLook({
    id: 'night-shift',
    label: 'Night shift',
    when: 'late hours, screens, neon, a city that never turns off. The original world.',
    scan: 0.03,
    grain: 0.028,
    calm: ['#141821', '#1e232f', '#2a3242', '#3a4358', '#e2e8f2', '#708090', '#4a5468', '#5e6a80', '#6e90f8', '#4a60d0', 0.5, 0.9],
    mid: ['#1c1c30', '#282650', '#3c3868', '#504a80', '#f8f0ff', '#a09cc0', '#6e68a0', '#8878ff', '#b8a0ff', '#6050d0', 0.85, 1.1],
    hot: ['#2e1e48', '#403058', '#604a80', '#9078b8', '#ffffff', '#f0d8e8', '#b888b8', '#ffd848', '#ffe880', '#d89818', 1.65, 1.6],
    dawn: ['#1a1614', '#262019', '#3a2f22', '#54432f', '#ffe8cc', '#c0a080', '#7a6450', '#e08a3c', '#ffc46a', '#a85e22', 0.95, 1.1],
  }),

  // ---------------------------------------------------------------------------
  paper: makeLook({
    id: 'paper',
    label: 'Paper',
    when: 'memory, handwriting, letters, folded things. Light background, ink type, no bloom.',
    scan: 0,
    grain: 0.022,
    vignette: { color: '#8a7a63', alpha: 0.16 },
    calm: ['#f4efe6', '#ece5d9', '#e0d7c7', '#c9bdab', '#2b2723', '#7d7266', '#a89b88', '#6b6156', '#b4552f', '#8c3f1f', 0.25, 0.75],
    mid: ['#f7f2ea', '#efe8dc', '#e3dacb', '#c2b5a2', '#241f1b', '#746a5e', '#9d907d', '#a14a28', '#c96a3c', '#7d3720', 0.35, 0.85],
    hot: ['#fbf7f1', '#f3ece0', '#e7dccb', '#b9ab97', '#1f1a16', '#6b6155', '#94856f', '#8c3f1f', '#e07a3f', '#6a2d16', 0.5, 0.95],
    dawn: ['#f6ede0', '#eee3d2', '#e2d4bf', '#c0ae95', '#2a221b', '#7b6a58', '#a8947c', '#b4652f', '#e59a5a', '#8a4520', 0.4, 0.9],
  }),

  // ---------------------------------------------------------------------------
  rain: makeLook({
    id: 'rain',
    label: 'Rain',
    when: 'overcast, windows, wet streets, a grey-blue day. Cold but not neon.',
    scan: 0.012,
    grain: 0.02,
    vignette: { color: '#0d1418', alpha: 0.26 },
    calm: ['#1a2026', '#232b33', '#2e3944', '#3f4d5b', '#e6edf3', '#7d8b99', '#57636f', '#6f8496', '#8fb4cc', '#4f6b80', 0.4, 0.8],
    mid: ['#1e262e', '#28323c', '#35424f', '#4a5b6b', '#eef4f8', '#8d9ba8', '#65727f', '#7f9bb0', '#a8c8dd', '#5a788c', 0.55, 0.9],
    hot: ['#232d36', '#2e3a46', '#3d4c5b', '#57697b', '#f5fafd', '#9fb0bd', '#77858f', '#9fbdd2', '#cfe6f5', '#6f8ea3', 0.8, 1.0],
    dawn: ['#2a2620', '#332f28', '#403a31', '#5a5145', '#f0e8dc', '#a89a86', '#7d7160', '#c98f5a', '#e8b47a', '#8f5f35', 0.6, 0.95],
  }),

  // ---------------------------------------------------------------------------
  daylight: makeLook({
    id: 'daylight',
    label: 'Daylight',
    when: 'morning, air, open spaces, something being repaired. Bright, low contrast, blue sky accents.',
    scan: 0,
    grain: 0.012,
    vignette: { color: '#6f8ba0', alpha: 0.14 },
    calm: ['#eaf1f5', '#e0eaf0', '#d2e0e8', '#b8cbd6', '#22333c', '#6c8593', '#9db2bd', '#4f93bd', '#2f74a0', '#7ab0cf', 0.45, 0.9],
    mid: ['#f0f6fa', '#e6eff5', '#d7e6ef', '#bacdd9', '#1d2f38', '#66808e', '#96adb9', '#3f86b3', '#1f6b9b', '#6ba6c9', 0.6, 1.0],
    hot: ['#f7fbfd', '#eef5fa', '#e0edf4', '#c1d4df', '#16262e', '#5c7684', '#8ba4b0', '#2f7fae', '#0f5f92', '#5c9dc4', 0.8, 1.1],
    dawn: ['#fbf3e8', '#f6ebdc', '#eee0cc', '#d8c3a8', '#2a2118', '#7f6a52', '#ab9070', '#c07a3a', '#e6a05c', '#8a5220', 0.55, 1.0],
  }),

  // ---------------------------------------------------------------------------
  ember: makeLook({
    id: 'ember',
    label: 'Ember',
    when: 'lamplight, warmth, a small room at night, someone waiting up. Dark but warm, never cyber.',
    scan: 0.02,
    grain: 0.03,
    calm: ['#17100e', '#221815', '#2f201b', '#463028', '#f2dcc8', '#98796a', '#6b5045', '#8a5a3c', '#d97a44', '#6a3a22', 0.55, 0.9],
    mid: ['#1e1512', '#2b1e19', '#3a2820', '#553a2e', '#f8e6d2', '#a98a78', '#7b5c4d', '#a8603a', '#f0904f', '#7d4123', 0.8, 1.0],
    hot: ['#261a15', '#342420', '#46302a', '#66452f', '#fff2e0', '#c4a08a', '#96705a', '#c9702f', '#ffb066', '#8f4a1d', 1.2, 1.15],
    dawn: ['#1a1310', '#261c17', '#372820', '#553a2e', '#ffe9d0', '#b08f78', '#826655', '#c07a3a', '#f0a860', '#8a5220', 0.9, 1.0],
  }),

  // ---------------------------------------------------------------------------
  mono: makeLook({
    id: 'mono',
    label: 'Mono',
    when: 'restraint, distance, documentary. No colour at all; weight comes from type and light.',
    scan: 0.025,
    grain: 0.04,
    calm: ['#101010', '#181818', '#222222', '#333333', '#ededed', '#8a8a8a', '#5e5e5e', '#7a7a7a', '#d0d0d0', '#555555', 0.35, 0.4],
    mid: ['#141414', '#1e1e1e', '#2a2a2a', '#3d3d3d', '#f4f4f4', '#9a9a9a', '#6e6e6e', '#909090', '#e8e8e8', '#606060', 0.5, 0.4],
    hot: ['#1a1a1a', '#262626', '#333333', '#4a4a4a', '#ffffff', '#b0b0b0', '#808080', '#b8b8b8', '#ffffff', '#707070', 0.7, 0.4],
    dawn: ['#1c1a17', '#262320', '#33302b', '#4a453d', '#f0ece4', '#a39887', '#7a7163', '#b09a78', '#d8c09a', '#6f5f45', 0.45, 0.5],
  }),
  // ---------------------------------------------------------------------------
  cafe: makeLook({
    id: 'cafe',
    label: 'Cafe',
    when: 'morning light, cream walls, coffee and sugar. Ordinary days told warmly.',
    scan: 0,
    grain: 0.022,
    vignette: { color: '#6b4a2a', alpha: 0.14 },
    calm: ['#f3ead9', '#eaddc6', '#f7f1e3', '#cbb99c', '#2a2119', '#7a6a55', '#a89a82', '#b06a2c', '#e08a3a', '#d9b98a', 0.3, 0.9],
    mid: ['#f6ecdb', '#efdfc4', '#fff8ea', '#c2ab8a', '#241c14', '#6f5f49', '#9c8a70', '#c2702a', '#f0952f', '#e6c79a', 0.45, 1.0],
    hot: ['#fbf0d8', '#f7e2bd', '#fffaf0', '#d8b98a', '#1f170f', '#7d6748', '#b09a74', '#d9741f', '#ffb347', '#f0cf9f', 0.7, 1.15],
    dawn: ['#2b2118', '#3a2c20', '#4b3929', '#6b523a', '#fdf3e2', '#c3a686', '#8d7658', '#e0913f', '#ffc46b', '#7a5c39', 0.5, 0.9],
  }),
};

export const DEFAULT_LOOK = 'night-shift';

/** Resolve a look id to its object, with a helpful error instead of a silent fallback. */
export function getLook(id) {
  if (!id) return LOOKS[DEFAULT_LOOK];
  const look = LOOKS[id];
  if (!look) {
    throw new Error(`unknown look "${id}"; available: ${Object.keys(LOOKS).join(', ')}`);
  }
  return look;
}

export const LOOK_IDS = Object.keys(LOOKS);
