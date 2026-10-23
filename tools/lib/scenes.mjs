// Load scenes that a storyboard brings with it.
//
// A storyboard can name local scene modules, so a song's bespoke scenes live
// next to its storyboard instead of inside the engine:
//
//   { "scenes": ["scenes/gutter.mjs", "scenes/shore.mjs"], "shots": [...] }
//
// Each module exports either `export const SCENES = { name: fn }` or a named
// export per scene. They are registered on top of the built-ins, so a local
// scene may intentionally shadow one of them.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENES } from '../../engine/scenes.mjs';

export async function loadUserScenes(storyboard, storyboardPath) {
  const list = storyboard?.scenes;
  if (!list || !list.length) return [];
  const base = path.dirname(path.resolve(storyboardPath));
  const loaded = [];
  for (const rel of list) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(base, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`storyboard names a scene module that does not exist: ${rel} (looked in ${base})`);
    }
    const mod = await import(pathToFileURL(abs).href);
    const bag = mod.SCENES ?? Object.fromEntries(
      Object.entries(mod).filter(([k, v]) => typeof v === 'function' && k !== 'default'),
    );
    for (const [name, fn] of Object.entries(bag)) {
      SCENES[name] = fn;
      loaded.push({ name, file: abs });
    }
  }
  return loaded;
}
