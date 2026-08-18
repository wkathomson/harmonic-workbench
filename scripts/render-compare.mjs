// Audio regression test: does the extracted engine still sound like the
// reference build?
//
// Renders the same note sequence through reference/web-synth-v11.html's engine
// and through the modules in src/audio/synth/, on an OfflineAudioContext in
// headless Chromium, for every factory preset — then compares the samples.
//
// Two things stop this being a naive byte-compare:
//
//  - The engine seeds its noise buffers, S&H table and reverb impulse from
//    Math.random, so a seeded PRNG is installed around each render. The reverb
//    IR is rebuilt on a 180 ms setTimeout, so the harness waits for that timer
//    while the PRNG is still installed.
//  - Chromium's own rendering is not bit-reproducible between two
//    OfflineAudioContexts: the reference compared against ITSELF drifts by up
//    to ~2e-6 (about -114 dB). So the pass threshold is that noise floor, not
//    zero. Run with CONTROL=1 to see the baseline for yourself.
//
// Usage (playwright is not a project dependency — install it just for this):
//   npm install --no-save playwright
//   node scripts/render-compare.mjs
//   CONTROL=1 node scripts/render-compare.mjs     # reference vs itself
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synth-compare-'));

// The reference engine is the top of its module script, down to the end of
// createSynth (the line before the UI banner). Sliced out by marker, not by
// hard-coded line numbers, so edits above it don't silently shift the window.
const html = fs.readFileSync(path.join(ROOT, 'reference/web-synth-v11.html'), 'utf8');
const body = html.slice(html.indexOf('<script type="module">') + '<script type="module">'.length);
const uiBanner = body.indexOf('/* ==========================================================================\n   UI');
if (uiBanner < 0) throw new Error('could not find the UI banner in the reference build');
fs.writeFileSync(path.join(tmp, 'ref-engine.js'), body.slice(0, uiBanner) + '\nexport { createSynth };\n');
// The "new" side is a mixer plus one part — the shape the Workbench uses.
// The reference side stays the original monolithic createSynth.
fs.writeFileSync(path.join(tmp, 'entry-new.js'), [
  `export { createMixer } from '${path.join(ROOT, 'src/audio/synth/mixer.js')}';`,
  `export { createPart } from '${path.join(ROOT, 'src/audio/synth/part.js')}';`,
  `export { FACTORY, applyPresetToPart } from '${path.join(ROOT, 'src/audio/synth/presets.js')}';`,
].join('\n'));

const bundle = (entry, name, out) => execFileSync('npx', [
  'esbuild', path.join(tmp, entry), '--bundle', '--format=iife',
  `--global-name=${name}`, `--outfile=${path.join(tmp, out)}`, '--log-level=warning',
], { cwd: ROOT, stdio: 'inherit' });
bundle('ref-engine.js', 'REFENG', 'ref-bundle.js');
bundle('entry-new.js', 'NEWENG', 'new-bundle.js');

const refSrc = fs.readFileSync(path.join(tmp, 'ref-bundle.js'), 'utf8');
const newSrc = fs.readFileSync(path.join(tmp, 'new-bundle.js'), 'utf8');

// PLAYWRIGHT_CHROMIUM lets a sandboxed environment point at its own build.
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
await page.goto('about:blank');
await page.addScriptTag({ content: refSrc });
await page.addScriptTag({ content: newSrc });

await page.evaluate((c) => { window.__CONTROL__ = c; }, process.env.CONTROL === '1');
const result = await page.evaluate(async () => {
  const seeded = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const realRandom = Math.random;

  async function renderRef(preset) {
    const ctx = new OfflineAudioContext(2, 44100 * 4, 44100);
    ctx.createMediaStreamDestination = function () { return this.createGain(); };
    Math.random = seeded(20260818);
    const engine = window.REFENG.createSynth(ctx, false);
    if (preset) {
      for (const [path, val] of Object.entries(preset.params ?? {})) {
        const [mod, key] = path.split('.');
        engine.setParam(mod, key, val);
      }
      (preset.modSlots ?? []).forEach((s, i) => engine.setModSlot(i, s));
    }
    // scheduleIR() rebuilds the reverb impulse on a 180 ms setTimeout, and
    // makeImpulse draws from Math.random. Wait for it while the seeded PRNG
    // is still installed, or the two renders get different reverb tails.
    await new Promise((r) => setTimeout(r, 400));
    engine.noteOn(60, 0.9, 0.05); engine.noteOff(60, 0.80);
    engine.noteOn(63, 0.6, 0.90); engine.noteOff(63, 1.60);
    engine.noteOn(67, 1.0, 1.70); engine.noteOff(67, 2.60);
    engine.noteOn(72, 0.4, 2.70); engine.noteOff(72, 3.40);
    const buf = await ctx.startRendering();
    Math.random = realRandom;
    return [buf.getChannelData(0), buf.getChannelData(1)];
  }

  // Phase 2 "new" side: one shared mixer + one part (poolSize 8), preset
  // applied through applyPresetToPart — exercises the split, not the
  // Phase 1 monolith.
  async function renderNew(preset) {
    const ctx = new OfflineAudioContext(2, 44100 * 4, 44100);
    ctx.createMediaStreamDestination = function () { return this.createGain(); };
    Math.random = seeded(20260818);
    const mixer = window.NEWENG.createMixer(ctx);
    const part = window.NEWENG.createPart(ctx, mixer, { poolSize: 8, crusherReady: false });
    if (preset) window.NEWENG.applyPresetToPart(part, mixer, preset);
    await new Promise((r) => setTimeout(r, 400));
    part.noteOn(60, 0.9, 0.05); part.noteOff(60, 0.80);
    part.noteOn(63, 0.6, 0.90); part.noteOff(63, 1.60);
    part.noteOn(67, 1.0, 1.70); part.noteOff(67, 2.60);
    part.noteOn(72, 0.4, 2.70); part.noteOff(72, 3.40);
    const buf = await ctx.startRendering();
    Math.random = realRandom;
    return [buf.getChannelData(0), buf.getChannelData(1)];
  }

  const cases = [['Init', null], ...Object.entries(window.NEWENG.FACTORY)];
  const out = [];
  for (const [name, preset] of cases) {
    const control = window.__CONTROL__;
    const a = await renderRef(preset);
    const b = control ? await renderRef(preset) : await renderNew(preset);
    let maxDiff = 0, rms = 0, peak = 0;
    for (let ch = 0; ch < 2; ch++) {
      for (let i = 0; i < a[ch].length; i++) {
        const d = Math.abs(a[ch][i] - b[ch][i]);
        if (d > maxDiff) maxDiff = d;
        if (Math.abs(a[ch][i]) > peak) peak = Math.abs(a[ch][i]);
        rms += a[ch][i] * a[ch][i];
      }
    }
    rms = Math.sqrt(rms / (a[0].length * 2));
    out.push({ name, maxDiff, refPeak: Number(peak.toFixed(5)), refRms: Number(rms.toFixed(5)) });
  }
  return out;
});

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });

// Chromium's own render-to-render drift sets the floor; anything under it is
// inaudible by a wide margin (-100 dB is already far below the noise of any
// playback system).
const FLOOR = 1e-4;
let bad = 0;
for (const r of result) {
  const ok = r.maxDiff < FLOOR;
  if (!ok) bad++;
  const dB = r.maxDiff > 0 ? `${(20 * Math.log10(r.maxDiff)).toFixed(0)} dB` : 'exact';
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(12)} maxDiff=${r.maxDiff.toExponential(2)} (${dB})  refPeak=${r.refPeak}  refRms=${r.refRms}`);
}
console.log(bad
  ? `\n${bad} of ${result.length} presets exceed the ${FLOOR} threshold — the engine has changed audibly.`
  : `\nAll ${result.length} presets render within ${FLOOR} of the reference.`);
process.exit(bad ? 1 : 0);
