// Imports QK's recorded voice clips (exported from the app's Studio) into audio/cues/.
// Usage: node tools/import-cues.mjs shred-voice.json   then commit and push.
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (src.format !== 'shred-voice-1') { console.error('Not a Shred voice export.'); process.exit(1); }
const ext = t => (/mp4|m4a|aac/.test(t) ? 'm4a' : /ogg/.test(t) ? 'ogg' : /mpeg|mp3/.test(t) ? 'mp3' : 'webm');
const dir = new URL('../audio/cues/', import.meta.url);
const manifestPath = new URL('manifest.json', dir);
let manifest = {}; try { const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); manifest = Array.isArray(m) ? Object.fromEntries(m.map(id => [id, id + '.mp3'])) : m; } catch {}
for (const [id, c] of Object.entries(src.clips)) {
  if (!/^[a-z0-9_]+$/i.test(id)) { console.warn('skipping odd id', id); continue; }
  const file = `${id}.${ext(c.type)}`;
  fs.writeFileSync(new URL(file, dir), Buffer.from(c.data, 'base64'));
  manifest[id] = file;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`Imported ${Object.keys(src.clips).length} clips. Manifest has ${Object.keys(manifest).length}. Commit audio/cues and push.`);
