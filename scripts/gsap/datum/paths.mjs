// Where the Datum demo's asset pipeline reads and writes.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../../..');
/** The generated masters and working files. Large, and not in git: .cache is ignored. */
export const masters = path.join(root, '.cache/gsap/datum-masters');
/** The web copies the demo serves. */
export const assets = path.join(root, 'public/assets/gsap/datum');
