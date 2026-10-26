import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('site');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]);
for (const ref of refs) {
  if (/^https:\/\//.test(ref)) continue;
  if (ref.startsWith('#')) { if (ref.length > 1) assert(ids.includes(ref.slice(1)), `Missing anchor ${ref}`); continue; }
  assert(fs.existsSync(path.join(root, ref)), `Missing asset ${ref}`);
}
for (const [, ref] of css.matchAll(/url\(['"]?([^)'" ]+)/g)) assert(fs.existsSync(path.join(root, ref)), `Missing font ${ref}`);
for (const view of ['home', 'library', 'video', 'audio']) assert(fs.existsSync(path.join(root, 'assets', `${view}.webp`)));
assert(html.includes('Skip to content'));
assert(html.includes('in development') || html.includes('In development'));
assert(!/<script[^>]+src="https?:/.test(html), 'Unexpected third-party script');
console.log(`Site validation passed: ${refs.length} links/assets, ${ids.length} unique IDs, four previews, local fonts.`);
