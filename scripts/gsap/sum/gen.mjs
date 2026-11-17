// Run a batch of image jobs: node scripts/gsap/sum/gen.mjs <jobs file> [parallel] [only-name,only-name]
// A jobs file (scripts/gsap/sum/jobs/*.json) holds { defaults?, jobs: [{ name, endpoint, input, refs?, single?, out?, keep? }] };
// `defaults` gives input shared by every job on an endpoint, which a job's own input overrides.
// Results are saved in .cache/gsap/sum-masters as <name>.<ext>; `refs` are files in that folder, sent with the
// request. This spends fal credit: the batch's cost and the credit left are printed at the end.
import fs from 'node:fs';
import path from 'node:path';
import { runJobs, here } from './fal.mjs';
import { masters } from './paths.mjs';
const [file, parallel = '3', only] = process.argv.slice(2);
if (!file) throw new Error('Usage: node scripts/gsap/sum/gen.mjs <jobs file> [parallel] [only-name,only-name]');
const spec = JSON.parse(fs.readFileSync(fs.existsSync(file) ? file : path.resolve(here, 'jobs', file), 'utf8'));
fs.mkdirSync(masters, { recursive: true });
const wanted = only ? only.split(',') : null;
const jobs = spec.jobs.filter(job => !wanted || wanted.includes(job.name)).map(job => ({ ...job, input: { ...(spec.defaults?.[job.endpoint] ?? {}), ...job.input } }));
const { results, spent, balance } = await runJobs(jobs, { dir: masters, parallel: Number(parallel) });
for (const result of results) console.log(result.ok ? `ok   ${result.name}: ${result.size} in ${result.seconds}s -> ${result.files.join(', ')}` : `FAIL ${result.name}: ${result.error}`);
console.log(`batch spent $${spent}; balance $${balance}`);
