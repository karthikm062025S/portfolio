// Reproduce golden.txt through the built wasm: the same seeds, holes and shot
// script as the native `golden_hashes` test. Exit 1 on any difference.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = process.argv[2] ?? join(here, "..", "public", "golf", "golf.wasm");
const golden = readFileSync(join(here, "golden.txt"), "utf8").trim().split(/\r?\n/);
const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
const w = instance.exports;

const SCRIPT = [[20, 63, 2], [30, 40, 1], [10, 30, 0], [40, 20, 3], [16, 12, 2], [24, 8, 2]];
const SEEDS = [20261027, 1, 0xdeadbeef];
const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");

const lines = [];
for (const seed of SEEDS) {
  w.new_course(seed);
  for (let k = 0; k < 9; k++) {
    w.hole_prepare(k);
    while (w.hole_solve(1 << 20) < 0);
    if (w.hole_start() !== 1) throw new Error(`hole_start failed for seed ${seed} hole ${k}`);
    for (const [a, p, s] of SCRIPT) {
      if (w.shoot(a, p, s) === 0) break;
      w.settle();
    }
    lines.push(`${seed} ${k} ${hex(w.hash_hi())}${hex(w.hash_lo())}`);
  }
}

let bad = 0;
for (let i = 0; i < Math.max(lines.length, golden.length); i++) {
  if (lines[i] !== golden[i]) {
    bad++;
    console.log(`mismatch line ${i + 1}: wasm ${lines[i]} golden ${golden[i]}`);
  }
}
if (bad) {
  console.log(`check.mjs: ${bad} of ${golden.length} hashes differ`);
  process.exit(1);
}

// Replay round trip through the wasm: two bot-played holes, encode, verify on
// the second instance, then tamper with the code.
w.new_course(SEEDS[0]);
const view = new Float64Array(w.memory.buffer, w.view_ptr(), 16);
for (let k = 0; k < 2; k++) {
  w.hole_prepare(k);
  while (w.hole_solve(1 << 20) < 0);
  w.hole_start();
  while (view[5] !== 3) {
    const m = w.bot_shot();
    w.shoot(m & 255, (m >> 8) & 63, (m >> 14) & 3);
    w.settle();
  }
}
const n = w.replay_encode();
const buf = new Uint8Array(w.memory.buffer, w.replay_buf_ptr(), 512);
if (w.replay_verify(n) !== 1) {
  console.log("check.mjs: replay of a wasm-played round does not verify");
  process.exit(1);
}
buf[n - 1] = buf[n - 1] === 65 ? 66 : 65;
if (w.replay_verify(n) === 1) {
  console.log("check.mjs: a tampered replay verified");
  process.exit(1);
}
console.log(`check.mjs: golden match (${lines.length} hashes, native == wasm); replay round trip verified`);
