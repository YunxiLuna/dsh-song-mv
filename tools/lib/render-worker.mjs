/**
 * The frame renderer, running inside a worker thread.
 *
 * Every frame is a pure function of song time, so a pool of these scales almost
 * linearly. The worker owns one engine (one canvas), renders the indices it is
 * handed, and ships raw RGBA back as a transferable buffer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { createEngine, parseLrc } from '../../engine/core.mjs';
import { loadUserScenes } from '../lib/scenes.mjs';

const { storyboardPath, width, height, fps } = workerData;

const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
const features = JSON.parse(fs.readFileSync(workerData.featuresPath, 'utf8'));

let lrc = [];
if (storyboard.lyricsFile) {
  const rel = path.resolve(path.dirname(path.resolve(storyboardPath)), storyboard.lyricsFile);
  const abs = path.resolve(storyboard.lyricsFile);
  const pick = fs.existsSync(rel) ? rel : (fs.existsSync(abs) ? abs : null);
  if (pick) lrc = parseLrc(pick);
}

await loadUserScenes(storyboard, storyboardPath);

const cfg = {
  render: { width, height, fps },
  post: storyboard.post || { scan: 0.03 },
  safety: storyboard.safety || { maxFlash: 0.7 },
  reactive: storyboard.reactive || { beatDecay: 6, onsetDecay: 9, strongOnset: 0.35 },
  text: storyboard.text || {},
};

const engine = createEngine({ cfg, features, storyboard, lrc });

parentPort.on('message', (msg) => {
  if (msg.cmd === 'frame') {
    const canvas = engine.renderFrame(msg.t);
    const img = canvas.getContext('2d').getImageData(0, 0, width, height);
    const buf = img.data.buffer;
    // hand the bytes over without a copy, then forget them here
    parentPort.postMessage({ cmd: 'frame', index: msg.index, buf }, [buf]);
  } else if (msg.cmd === 'exit') {
    process.exit(0);
  }
});

parentPort.postMessage({ cmd: 'ready' });
