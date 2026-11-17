// Small fal.ai client for the Sum demo's images. The key is read from
// .env.local at the repo root (fal_api=...), which is not in git; it is never printed, and is taken
// out of any error text. Every request is noted in .cache/gsap/sum-masters/ledger.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { here, masters, root } from './paths.mjs';
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const KEY = (/^fal_api=(.*)$/m.exec(env)?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
if (!KEY) throw new Error('fal_api is not set in .env.local');
const headers = { Authorization: `Key ${KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'studio-assets/1.0' };
const scrub = text => String(text).split(KEY).join('<key>');
export { here };
export const ledgerFile = path.join(masters, 'ledger.jsonl');
const log = entry => { fs.mkdirSync(masters, { recursive: true }); fs.appendFileSync(ledgerFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'); };

/** GET on fal's platform API (catalogue, pricing, usage). */
export async function platform(route) {
  const res = await fetch(`https://api.fal.ai/v1${route}`, { headers });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = scrub(text).slice(0, 600); }
  return { status: res.status, body };
}
/** Credit left on the account, in USD. */
export async function balance() {
  const { body } = await platform('/account/billing?expand=credits');
  return body?.credits?.current_balance ?? null;
}
/** Queue a request, wait for it, return the result. */
export async function run(endpoint, input, { note = '', timeout = 900000 } = {}) {
  const started = Date.now();
  const submit = await fetch(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(input) });
  const queued = await submit.json().catch(() => ({}));
  if (!submit.ok || !queued.request_id) throw new Error(`submit ${endpoint}: ${submit.status} ${scrub(JSON.stringify(queued)).slice(0, 500)}`);
  for (;;) {
    await new Promise(r => setTimeout(r, 2500));
    const status = await (await fetch(queued.status_url, { headers })).json().catch(() => ({}));
    if (status.status === 'COMPLETED') break;
    if (status.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(status.status)) throw new Error(`${endpoint}: ${scrub(JSON.stringify(status)).slice(0, 500)}`);
    if (Date.now() - started > timeout) throw new Error(`${endpoint}: timed out after ${timeout}ms`);
  }
  const res = await fetch(queued.response_url, { headers });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${endpoint} result: ${res.status} ${scrub(JSON.stringify(result)).slice(0, 700)}`);
  log({ endpoint, note, seconds: Math.round((Date.now() - started) / 1000), request: queued.request_id });
  return result;
}
/** Save a result URL to disk. */
export async function save(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
/** A local image as a data URI, for edit endpoints. */
export const dataUri = file => `data:image/${file.endsWith('.png') ? 'png' : file.endsWith('.webp') ? 'webp' : 'jpeg'};base64,${fs.readFileSync(file).toString('base64')}`;

/**
 * Run a list of jobs, a few at a time. A job: { name, endpoint, input, refs?, out? }.
 * `refs` are local files sent as input.image_urls (or input.image_url when `single` is set).
 * Images are saved as <out or name>.<ext>, with -2, -3 for further images. Returns a summary per job.
 */
export async function runJobs(jobs, { dir, parallel = 3 } = {}) {
  const before = await balance();
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const started = Date.now();
      try {
        const input = { ...job.input };
        if (job.refs?.length) {
          const uris = job.refs.map(file => dataUri(path.resolve(dir, file)));
          if (job.single) input.image_url = uris[0]; else input.image_urls = uris;
        }
        const result = await run(job.endpoint, input, { note: job.name });
        const images = result.images ?? (result.image ? [result.image] : []);
        const saved = [];
        for (const [index, image] of images.entries()) {
          const ext = (image.content_type ?? '').includes('jpeg') ? 'jpg' : (image.content_type ?? '').includes('webp') ? 'webp' : (image.url ?? '').split('?')[0].split('.').pop() || 'png';
          saved.push(await save(image.url, path.resolve(dir, `${job.out ?? job.name}${index ? `-${index + 1}` : ''}.${['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'}`)));
        }
        if (job.keep) fs.writeFileSync(path.resolve(dir, `${job.out ?? job.name}.json`), JSON.stringify(result, null, 1));
        results.push({ name: job.name, ok: true, seconds: Math.round((Date.now() - started) / 1000), files: saved.map(file => path.basename(file)), size: images[0] ? `${images[0].width ?? '?'}x${images[0].height ?? '?'}` : '' });
      } catch (error) {
        results.push({ name: job.name, ok: false, error: scrub(error.message).slice(0, 500) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, worker));
  await new Promise(r => setTimeout(r, 8000));
  const after = await balance();
  const spent = before != null && after != null ? Math.round((before - after) * 10000) / 10000 : null;
  log({ batch: jobs.map(job => job.name), spent, balance: after });
  return { results, spent, balance: after };
}
