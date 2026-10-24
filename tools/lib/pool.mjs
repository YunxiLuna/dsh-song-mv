/**
 * A render pool: N worker threads, each with its own engine and canvas.
 *
 * Frames are a pure function of time, so ordering is the only thing that has to
 * be managed: workers render whatever index they are handed, the main thread
 * holds finished frames in a small reorder window and writes them to ffmpeg in
 * order. Workers get one in-flight frame each, which is enough — the pipe is
 * the bottleneck, not the messaging.
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const here = path.dirname(fileURLToPath(import.meta.url));

export function defaultWorkers() {
  const n = os.cpus()?.length ?? 4;
  // leave a core for the main thread and the encoder; cap memory use
  return Math.max(1, Math.min(8, n - 1));
}

/**
 * @param {object} opts
 * @param {string} opts.storyboardPath
 * @param {string} opts.featuresPath
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {number} opts.fps
 * @param {number} opts.start      seconds
 * @param {number} opts.total      frame count
 * @param {number} opts.workers
 * @param {(i:number, buf:Buffer)=>Promise<void>} opts.onFrame  called in order
 * @param {(done:number, total:number)=>void} [opts.onProgress]
 */
export async function renderWithPool(opts) {
  const { storyboardPath, featuresPath, width, height, fps, start, total } = opts;
  const wanted = Math.max(1, Math.min(opts.workers ?? defaultWorkers(), total));
  const workers = [];
  const ready = [];

  for (let i = 0; i < wanted; i++) {
    const w = new Worker(path.join(here, 'render-worker.mjs'), {
      workerData: { storyboardPath, featuresPath, width, height, fps },
    });
    w.on('error', (err) => {
      console.error(`worker failed: ${err?.stack ?? err}`);
      process.exit(1);
    });
    workers.push(w);
    ready.push(new Promise((res) => {
      const onMsg = (m) => {
        if (m?.cmd === 'ready') {
          w.off('message', onMsg);
          res(w);
        }
      };
      w.on('message', onMsg);
    }));
  }
  await Promise.all(ready);

  const free = workers.slice();
  const pending = new Map();      // index -> Buffer
  const busy = new Map();         // worker -> index
  let nextToQueue = 0;
  let nextToWrite = 0;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const frameTime = (i) => start + i / fps;

  const flush = async () => {
    while (pending.has(nextToWrite)) {
      const buf = pending.get(nextToWrite);
      pending.delete(nextToWrite);
      const i = nextToWrite;
      nextToWrite++;
      await opts.onFrame(i, buf);
      opts.onProgress?.(nextToWrite, total);
      if (nextToWrite >= total) resolveDone();
    }
  };

  // one in-flight frame per worker, plus a small look-ahead window so a fast
  // worker can pick up the next index without waiting on the slowest one
  const WINDOW = wanted * 2;
  const pump = async () => {
    while (free.length && nextToQueue < total && nextToQueue < nextToWrite + WINDOW) {
      const w = free.pop();
      const index = nextToQueue++;
      busy.set(w, index);
      w.postMessage({ cmd: 'frame', index, t: frameTime(index) });
    }
  };

  for (const w of workers) {
    w.on('message', (m) => {
      if (m?.cmd !== 'frame') return;
      busy.delete(w);
      pending.set(m.index, Buffer.from(m.buf));
      free.push(w);
      flush().then(pump);
    });
  }

  pump();
  await done;

  for (const w of workers) w.postMessage({ cmd: 'exit' });
  await Promise.all(workers.map((w) => new Promise((r) => w.once('exit', r))));
}
