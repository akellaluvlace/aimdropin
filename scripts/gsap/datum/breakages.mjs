// Does verify-datum still catch what it says it catches? This breaks the Datum page on purpose, one fault
// at a time, runs the check against a DEV server (which takes each change in as it is made), and puts
// the file back exactly as it was.
//
//   npx next dev --webpack -p 3024          (in another terminal: a dev server of your own)
//   BASE_URL=http://localhost:3024 node scripts/gsap/datum/breakages.mjs [name,name]
//
// Run it from the repo's root, on a clean tree: IT EDITS THE PAGE'S SOURCE FILES while it runs. Each is
// restored when its trial ends, also after Ctrl-C; if the process is killed outright, `git status` shows
// what was left and `git checkout` puts it back. Never build or commit while it is running.
//
// A trial is "caught" when the check fails with the message the fault should give, and "MISSED" when the
// check passes: then the check has a hole. That is how it was found that no line of the drawing was ever
// drawn. A trial whose text is no longer in the source says so
// ("NOT APPLIED"): the page has changed, and the trial has to be written again.
//
// Each trial runs the quick check (QUICK=1) to its first failure, a minute or two; the ones marked
// `sweeps` run a window-size sweep instead, which takes longer.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// DRY=1 only says whether each trial's text is still in the source, and changes nothing.
const dry = !!process.env.DRY;
const base = process.env.BASE_URL;
if (!base && !dry) { console.error('Set BASE_URL to a dev server of this checkout, for example BASE_URL=http://localhost:3024 (or DRY=1 to see which trials still apply)'); process.exit(1); }
const repo = process.cwd();
const dir = path.join(repo, 'components/gsap/datum');
if (!fs.existsSync(path.join(dir, 'timeline.ts'))) { console.error('Run this from the root of the repo.'); process.exit(1); }
const only = process.argv[2]?.split(',');

const level = (picture, to) => ({ file: 'survey.ts', find: new RegExp(`("${picture}": \\{\\s+"dir": "seq",\\s+"level": )1326\\.8`), with: `$1${to}` });
const TRIALS = [
  // ---------- The photographs on the datum and on each other ----------
  { name: 'the building site 4px low', ...level('build', '1330.8'), expect: /structure: the photograph's ground line lies on the finished house's/ },
  { name: 'the building site 2px low', ...level('build', '1328.8'), expect: /structure: the photograph's ground line lies on the finished house's/ },
  { name: 'the building site 2px high', ...level('build', '1324.8'), expect: /structure: the photograph's ground line lies on the finished house's/ },
  { name: 'dusk 3px high', ...level('dusk', '1323.8'), expect: /evening: the photograph's (eaves|ground line) lies? on the finished house's/ },
  { name: 'dusk 4px to one side', file: 'survey.ts', find: /("dusk": \{[\s\S]*?"m": \[\s+)0(,\s+0,\s+)2880/, with: '$14$22884', expect: /evening: the photograph's east end lies on the finished house's/ },
  // ---------- The drawing ----------
  { name: 'the lines of the drawing put there at once', edits: [
    { file: 'drawing.ts', find: 'export const PEN = 1000;', with: 'export const PEN = 1;' },
    { file: 'timeline.ts', find: 'immediateRender: false, autoRound: false }', with: 'immediateRender: false }' },
  ], expect: /is drawn along its length/ },
  { name: 'the pen hurried', file: 'timeline.ts', find: "drawn(lines('course'), [SCORE.roof[1], SCORE.detail[1]], 0.62);", with: "drawn(lines('course'), SCORE.detail, 0.3, 'power1.inOut');", expect: /The pen is not hurried/ },
  { name: 'ticks timed as if the pen went at an even pace', file: 'timeline.ts', find: 'const passes = (share: number) => bays[0] + (bays[1] - bays[0]) * reached(share);', with: 'const passes = (share: number) => bays[0] + (bays[1] - bays[0]) * (0.08 + 0.84 * share);', expect: /is not there before its line has reached it|is there as the pen passes it/ },
  { name: 'every tick a little early', file: 'timeline.ts', find: 'const passes = (share: number) => bays[0] + (bays[1] - bays[0]) * reached(share);', with: 'const passes = (share: number) => bays[0] + (bays[1] - bays[0]) * reached(share) - 0.03;', expect: /is not there before its line has reached it/ },
  { name: 'a figure that counts at another pace than its line', file: 'timeline.ts', find: "set('len', whole, house.length, steady, 0);", with: "set('len', whole, house.length, 'power1.inOut', 0);", expect: /says what its line has drawn so far/ },
  { name: 'a move that ends after its rest', file: 'score.ts', find: 'detail: [3.86, 4.26],', with: 'detail: [3.86, 4.5],', expect: /nothing is half way at a rest/ },
  // ---------- Night ----------
  { name: 'a light spills into the window under it', edits: [
    { file: 'plate.ts', find: 'const low = HOUSE.ground - (o.y + o.h) < 2.3 * HOUSE.perMetre', with: 'const low = HOUSE.ground - (o.y + o.h) < 280' },
    { file: 'plate.ts', find: 'if (other === index) continue;', with: 'continue;' },
  ], expect: /turn has not come and it is still dark/ },
  { name: 'the sentences keep a tone of their own through dusk', file: 'plate.ts', find: 'export const softTone = (night: number) => (night >= TURN ? mix(NIGHT.ink, NIGHT.soft, (night - TURN) / (1 - TURN)) : mix(DAY.soft, DAY.ink, night / TURN));', with: 'export const softTone = (night: number) => mix(DAY.soft, NIGHT.soft, inkTurn(night));', expect: /the sentences stay readable/ },
  { name: 'the ink eased from dark to light', file: 'plate.ts', find: 'export const inkTurn = (night: number) => (night >= TURN ? 1 : 0);', with: 'export const inkTurn = (night: number) => night;', expect: /stay readable on the paper/ },
  // ---------- Rooms, pace and scroll ----------
  { name: 'the last words rise while the last building is leaving', file: 'score.ts', find: 'last: [20.74, 21.0],', with: 'last: [20.56, 20.98],', expect: /are not over a photograph/ },
  { name: 'the picture moved with a slow-in, slow-out ease', file: 'timeline.ts', find: "WORKS.forEach((work, index) => set('street', work.arrive, index, steady, index - 1));", with: "WORKS.forEach((work, index) => set('street', work.arrive, index, 'power3.inOut', index - 1));", expect: /Nothing in the picture lurches/ },
  { name: 'a write to the document scroll on every frame', file: 'mount.ts', find: '    words.seek(at);\n    follow();', with: '    words.seek(at);\n    window.scrollTo(0, 0);\n    follow();', expect: /wrote to the document scroll/ },
  { name: "nothing keeps clear of the datum's level", file: 'mount.ts', find: 'keep: width - tag.left + 7 };', with: 'keep: 0 };', expect: /stays on the plate|does not cover|clear of the datum's level/ },
  { name: 'a quick setter on an alias (older engines throw)', file: 'mount.ts', find: '    tl.to(levelMark, { autoAlpha: 1, duration: quick || 0.4 }, reduced ? 0 : 0.85);', with: "    tl.to(levelMark, { autoAlpha: 1, duration: quick || 0.4 }, reduced ? 0 : 0.85);\n    gsap.quickSetter(levelMark, 'autoAlpha')(1);", expect: /older engine/ },
  { name: 'the first words left standing under the bar of a low stage', file: 'datum.module.css', find: '--first: clamp(46px, min(11.2cqw, calc((100cqh - var(--strip) - var(--below) - var(--bar)) * .36)), 210px);', with: '--first: clamp(46px, 11.2cqw, 210px);', expect: /stay under the bar|fit the sheet/, sweeps: 'wide' },
];

let stopped = false;
process.on('SIGINT', () => { stopped = true; });
const results = [];
for (const trial of TRIALS) {
  if (stopped) break;
  if (only && !only.some(name => trial.name.includes(name))) continue;
  const edits = trial.edits ?? [{ file: trial.file, find: trial.find, with: trial.with }];
  if (dry) {
    const found = edits.every(edit => { const text = fs.readFileSync(path.join(dir, edit.file), 'utf8'); return text.replace(edit.find, edit.with) !== text; });
    results.push([trial.name, found ? 'caught' : 'NOT APPLIED']);
    console.log(`${found ? 'applies    ' : 'NOT APPLIED'}  ${trial.name}`);
    continue;
  }
  const originals = new Map();
  const restore = () => { for (const [file, text] of originals) fs.writeFileSync(file, text); };
  let applied = true;
  for (const edit of edits) {
    const file = path.join(dir, edit.file);
    if (!originals.has(file)) originals.set(file, fs.readFileSync(file, 'utf8'));
    const current = fs.readFileSync(file, 'utf8'), broken = current.replace(edit.find, edit.with);
    if (broken === current) { applied = false; break; }
    fs.writeFileSync(file, broken);
  }
  if (!applied) { restore(); results.push([trial.name, 'NOT APPLIED: the text to change was not found']); console.log(`${trial.name}\n    NOT APPLIED: the text to change was not found\n`); continue; }
  let outcome = '';
  try {
    // Let the dev server take the change in, then run the check to its first failure.
    spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '120', `${base}/datum`]);
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},2500)']);
    spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '120', `${base}/datum`]);
    const run = spawnSync(process.execPath, ['scripts/gsap/verify-datum.mjs'], { cwd: repo, env: { ...process.env, BASE_URL: base, ...(trial.sweeps ? { SWEEPS: trial.sweeps } : { QUICK: '1' }) }, encoding: 'utf8', timeout: 1500000 });
    const output = `${run.stdout}\n${run.stderr}`;
    const failure = output.split('\n').find(line => /AssertionError|^\s*Error:|findings in the window-size sweeps/.test(line)) ?? '';
    const passed = /all checks passed|sweeps passed/.test(output) && run.status === 0;
    const reached = output.split('\n').filter(line => /: ok/.test(line)).map(line => line.split(':')[0]).pop() ?? 'nothing';
    const said = trial.sweeps ? output.split('\n').filter(line => /^\d+x\d+ /.test(line)).slice(0, 2).join(' | ') : failure;
    outcome = passed ? 'MISSED: the check passed' : trial.expect.test(output) ? `caught (after "${reached}"): ${said.replace(/^AssertionError \[ERR_ASSERTION\]: /, '').slice(0, 230)}` : `failed, but not as expected (after "${reached}"): ${said.slice(0, 260)}`;
  } finally {
    restore();
  }
  results.push([trial.name, outcome]);
  console.log(`${trial.name}\n    ${outcome}\n`);
}
if (dry) { console.log(`${results.filter(([, outcome]) => outcome === 'caught').length} of ${results.length} trials still apply to the source`); process.exit(0); }
// Give the dev server the restored files before anything else looks at it.
spawnSync('curl', ['-s', '-o', '/dev/null', '--max-time', '120', `${base}/datum`]);
console.log(`${results.filter(([, outcome]) => outcome.startsWith('caught')).length} of ${results.length} caught${stopped ? ' (stopped)' : ''}`);
