// Build a dashboard whose repo ships sources, not finished HTML. Everything
// third-party (install scripts, bundlers) runs inside `docker run --rm` with
// only the work folder and our read-only patches mounted. node_modules lives
// in a per-slug Docker volume: faster than a macOS bind mount, and it keeps
// the install off the host.

import { spawn } from "node:child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PATCHES = path.join(HERE, "patches");
const SLOTS_DIR = path.join(process.cwd(), ".cache", "dashboards", ".build-slots");
// Docker has ~12 GB here; three Node builds at once is the safe ceiling,
// shared by every importer process on the machine.
const MAX_SLOTS = Number(process.env.DASHBOARD_BUILD_SLOTS ?? 3);

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireSlot(label) {
  mkdirSync(SLOTS_DIR, { recursive: true });
  for (;;) {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const dir = path.join(SLOTS_DIR, `slot-${i}`);
      try {
        mkdirSync(dir);
        writeFileSync(path.join(dir, "owner"), JSON.stringify({ pid: process.pid, label, at: Date.now() }));
        return () => rmSync(dir, { recursive: true, force: true });
      } catch {
        // Taken: reclaim it if its owner died.
        try {
          const owner = JSON.parse(readFileSync(path.join(dir, "owner"), "utf8"));
          if (!alive(owner.pid)) rmSync(dir, { recursive: true, force: true });
        } catch {
          // owner file not written yet; leave it
        }
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

function sh(cmd, args, { log, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`timed out after ${Math.round(timeoutMs / 60000)} min`));
    }, timeoutMs);
    let tail = "";
    const keep = (d) => {
      log.write(d);
      tail = (tail + d).slice(-2000);
    };
    p.stdout.on("data", keep);
    p.stderr.on("data", keep);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`exit ${code}: ${tail.slice(-700)}`));
    });
  });
}

/**
 * Copy srcDir to workDir, apply the patch and build in Docker.
 * @returns {Promise<string>} the build output folder
 */
export async function buildSite(source, srcDir, workDir, { logFile, timeoutMs = 25 * 60_000 } = {}) {
  const site = source.site;
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(path.dirname(workDir), { recursive: true });
  cpSync(srcDir, workDir, {
    recursive: true,
    filter: (p) => !/(^|\/)\.aim-sha$/.test(p),
  });
  const base = `/demos/${source.slug}/`;
  const env = {
    DEMO_BASE: base,
    DEMO_BASE_NOSLASH: base.replace(/\/$/, ""),
    DEMO_SLUG: source.slug,
    CI: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    NUXT_TELEMETRY_DISABLED: "1",
    ASTRO_TELEMETRY_DISABLED: "1",
    NG_CLI_ANALYTICS: "false",
    HUSKY: "0",
    COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
    NODE_OPTIONS: "--max-old-space-size=4096",
    ...(site.env ?? {}),
  };
  const steps = ["corepack enable >/dev/null 2>&1 || true"];
  if (site.patch) {
    if (!existsSync(path.join(PATCHES, site.patch))) throw new Error(`patch ${site.patch} is missing`);
    steps.push(site.patch.endsWith(".mjs") ? `node /patches/${site.patch}` : `sh /patches/${site.patch}`);
  }
  steps.push(site.install, site.build);
  const args = [
    "run", "--rm",
    "--name", `aim-build-${source.slug}`,
    "-v", `${workDir}:/app`,
    "-v", `aim-nm-${source.slug}:/app/node_modules`,
    "-v", "aim-npm-cache:/root/.npm",
    "-v", "aim-pnpm-store:/root/.local/share/pnpm/store",
    "-v", "aim-yarn-cache:/usr/local/share/.cache/yarn",
    "-v", `${PATCHES}:/patches:ro`,
    "-w", "/app",
    ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
    site.image,
    "sh", "-lc", steps.join(" && "),
  ];
  const log = createWriteStream(logFile, { flags: "w" });
  log.write(`$ docker ${args.join(" ")}\n\n`);
  const release = await acquireSlot(source.slug);
  try {
    // A container left over from an interrupted run would block the name.
    await sh("docker", ["rm", "-f", `aim-build-${source.slug}`], { log, timeoutMs: 60_000 }).catch(() => {});
    await sh("docker", args, { log, timeoutMs });
  } finally {
    release();
    log.end();
  }
  const out = path.join(workDir, site.out);
  if (!existsSync(out)) throw new Error(`build finished but ${site.out} is missing`);
  return out;
}
