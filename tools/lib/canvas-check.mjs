// Analyze bridge: the CLI shells out to the pure-JS analyzer inside the plugin.
// Keeping ffmpeg only for *decoding* is what makes this dependency-light.
import { createCanvas } from 'canvas';
export { readWav, analyze } from './analyze.mjs';

// Sanity check used by the CLI: the package needs node-canvas for rendering.
export function assertCanvas() {
  try {
    createCanvas(2, 2);
    return true;
  } catch (e) {
    throw new Error('node-canvas is not available: ' + (e?.message || e));
  }
}
