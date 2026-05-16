// Container cold-start benchmark — m1-test-resources.md §4
//
// What it measures: `docker run` start → ws server ready (TCP listening on 7000).
// This is the *local* analogue of CF Containers cold-start. The CF target is < 2s
// (tech-design §9). Local Docker is a loose proxy — useful to catch regressions
// in image size / install time, not to validate the real cloud SLA.
//
// Usage:
//   1. cd sandbox/agent-base && docker build -t agent-base .
//   2. node sandbox/bench/cold-start.mjs           # default N=10
//   3. N=20 PORT=7001 node sandbox/bench/cold-start.mjs
//
// Output: per-run latency + p50/p95/min/max summary.

import { spawn, execSync } from "node:child_process";
import { connect } from "node:net";

const N = Number(process.env.N ?? 10);
const PORT = Number(process.env.PORT ?? 7000);
const IMAGE = process.env.IMAGE ?? "agent-base";
const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_MS ?? 30_000);
const PROBE_INTERVAL_MS = 25;

function probeOnce(port) {
  return new Promise((resolve) => {
    const s = connect({ host: "127.0.0.1", port }, () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.setTimeout(500, () => {
      s.destroy();
      resolve(false);
    });
  });
}

async function waitReady(port, deadline) {
  while (Date.now() < deadline) {
    if (await probeOnce(port)) return true;
    await new Promise((r) => setTimeout(r, PROBE_INTERVAL_MS));
  }
  return false;
}

function startContainer() {
  // Detached, foreground-bound port. Capture id to stop later.
  const out = execSync(
    `docker run -d --rm -p ${PORT}:7000 ${IMAGE}`,
    { encoding: "utf8" },
  ).trim();
  return out; // container id
}

function stopContainer(id) {
  try {
    execSync(`docker stop ${id}`, { stdio: "ignore" });
  } catch {
    /* ignore */
  }
}

function p(arr, q) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(`# cold-start bench: image=${IMAGE} port=${PORT} N=${N}`);
  const samples = [];

  for (let i = 1; i <= N; i++) {
    const t0 = Date.now();
    let id;
    try {
      id = startContainer();
    } catch (e) {
      console.error(`run ${i}: docker run failed: ${e.message}`);
      continue;
    }

    const ok = await waitReady(PORT, t0 + READY_TIMEOUT_MS);
    const dt = Date.now() - t0;
    if (ok) {
      samples.push(dt);
      console.log(`run ${i.toString().padStart(2)}: ready in ${dt} ms`);
    } else {
      console.log(`run ${i.toString().padStart(2)}: NOT READY in ${READY_TIMEOUT_MS} ms`);
    }
    stopContainer(id);
  }

  if (samples.length === 0) {
    console.error("no successful runs");
    process.exit(1);
  }

  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const mean = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  console.log("---");
  console.log(`samples:  ${samples.length}/${N}`);
  console.log(`min/max:  ${min} / ${max} ms`);
  console.log(`mean:     ${mean} ms`);
  console.log(`p50:      ${p(samples, 0.5)} ms`);
  console.log(`p95:      ${p(samples, 0.95)} ms`);
  console.log("---");
  console.log("# CF Containers SLA target: < 2000 ms (tech-design §9)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
