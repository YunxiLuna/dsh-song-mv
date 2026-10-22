// Shared helpers: ffmpeg discovery, probing, and frame streaming.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';

export function which(cmd) {
  // Cross-platform PATH probe without a shell.
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  const dirs = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
  for (const d of dirs) {
    for (const e of exts) {
      const p = `${d}/${cmd}${e}`;
      try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
    }
  }
  return null;
}

export function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  return which('ffmpeg');
}

export function ffmpegHint() {
  const hints = {
    win32: 'winget install Gyan.FFmpeg  (or: scoop install ffmpeg)',
    darwin: 'brew install ffmpeg',
    linux: 'sudo apt install ffmpeg  (or your distro\'s package)',
  };
  return hints[process.platform] || 'install ffmpeg via your package manager';
}

export function requireFfmpeg() {
  const p = ffmpegPath();
  if (!p) {
    console.error('\nffmpeg not found on PATH.');
    console.error('This tool shells out to ffmpeg; it is not bundled. Install it first:');
    console.error('  ' + ffmpegHint() + '\n');
    process.exit(2);
  }
  return p;
}

export function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
  return once(child, 'exit').then(([code]) => {
    if (code !== 0) throw new Error(`${cmd} exited with ${code}`);
  });
}

/** Decode any audio file to float-free 16-bit mono WAV at `rate` Hz. */
export async function toWav(input, output, rate = 44100) {
  await run(requireFfmpeg(), [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', input, '-ac', '1', '-ar', String(rate), '-c:a', 'pcm_s16le', output,
  ]);
}

/**
 * Encode raw RGBA frames from a stream into an H.264 mp4, then mux audio.
 * Frames arrive on ffmpeg's stdin so nothing touches disk.
 */
export function createFrameSink({ width, height, fps, outFile, audioFile, crf = 18, preset = 'veryfast' }) {
  const bin = requireFfmpeg();
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba',
    '-s', `${width}x${height}`, '-r', String(fps),
    '-i', 'pipe:0',
    '-i', audioFile,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart',
    outFile,
  ];
  const child = spawn(bin, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
  return {
    async write(rgbaBuffer) {
      if (!child.stdin.write(rgbaBuffer)) await once(child.stdin, 'drain');
    },
    async close() {
      child.stdin.end();
      await done;
    },
    abort() { try { child.kill('SIGKILL'); } catch { /* ignore */ } },
  };
}

export async function probeDuration(file) {
  const bin = requireFfmpeg();
  const child = spawn(bin, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => { err += d.toString(); });
  await once(child, 'close');
  const m = err.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
  if (!m) return null;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 100;
}
