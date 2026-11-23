// Benchmark: csv-reader-speed run() vs PapaParse on deterministic in-memory fixtures.
// Usage: npm install && node bench/bench.mjs

import Papa from 'papaparse';
import { performance } from 'node:perf_hooks';
import { run } from '../solve.js';

const WARMUP = 1;
const RUNS = 5;

// Seeded PRNG (mulberry32).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function word(rand, min, max) {
  const len = min + Math.floor(rand() * (max - min + 1));
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}

function makePlain(rows, cols, seed) {
  const rand = mulberry32(seed);
  const lines = new Array(rows);
  for (let r = 0; r < rows; r++) {
    const fields = new Array(cols);
    for (let c = 0; c < cols; c++) fields[c] = word(rand, 1, 8);
    lines[r] = fields.join(',');
  }
  return lines.join('\n');
}

function makeQuoted(rows, cols, seed) {
  const rand = mulberry32(seed);
  const lines = new Array(rows);
  for (let r = 0; r < rows; r++) {
    const fields = new Array(cols);
    for (let c = 0; c < cols; c++) {
      let raw = word(rand, 1, 8);
      const p = rand();
      if (p < 0.15) raw += ', ' + word(rand, 1, 6); // contains a comma
      else if (p < 0.25) raw += ' "' + word(rand, 1, 6) + '"'; // contains quotes
      else if (p < 0.3) raw = word(rand, 1, 4) + ', "' + word(rand, 1, 4) + '"'; // both
      fields[c] = '"' + raw.replaceAll('"', '""') + '"';
    }
    lines[r] = fields.join(',');
  }
  return lines.join('\n');
}

const fixtures = [
  { name: 'plain', text: makePlain(100_000, 6, 0x1234abcd) },
  { name: 'quoted', text: makeQuoted(50_000, 6, 0x5eed5eed) },
];
for (const f of fixtures) f.bytes = Buffer.byteLength(f.text, 'utf8');

const parsers = [
  {
    name: 'csv-reader-speed',
    parse(text) {
      const r = run({ text, header: false });
      return { rows: r.rows.length, errors: r.errors.length };
    },
  },
  {
    name: 'papaparse',
    parse(text) {
      const r = Papa.parse(text, {});
      return { rows: r.data.length, errors: r.errors.length };
    },
  },
];

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

console.log(`Node ${process.version} (${process.platform} ${process.arch})`);
console.log('');
console.log('Fixtures:');
for (const f of fixtures) {
  console.log(`- ${f.name}: ${f.bytes.toLocaleString('en-US')} bytes (${(f.bytes / 1e6).toFixed(2)} MB)`);
}
console.log('');

const results = [];
for (const f of fixtures) {
  const counts = {};
  for (const p of parsers) {
    let info = null;
    for (let k = 0; k < WARMUP; k++) info = p.parse(f.text);
    const times = [];
    for (let k = 0; k < RUNS; k++) {
      const t0 = performance.now();
      info = p.parse(f.text);
      times.push(performance.now() - t0);
    }
    counts[p.name] = info.rows;
    if (info.errors > 0) {
      console.warn(`WARNING: ${p.name} reported ${info.errors} error(s) on fixture "${f.name}"`);
    }
    const ms = median(times);
    results.push({ fixture: f.name, parser: p.name, ms, mbps: f.bytes / 1e6 / (ms / 1000) });
  }
  const distinct = new Set(Object.values(counts));
  if (distinct.size > 1) {
    console.warn(`WARNING: row counts differ on fixture "${f.name}": ${JSON.stringify(counts)}`);
  }
}

console.log('| Fixture | Parser | median ms | MB/s |');
console.log('|---|---|---:|---:|');
for (const r of results) {
  console.log(`| ${r.fixture} | ${r.parser} | ${r.ms.toFixed(2)} | ${r.mbps.toFixed(1)} |`);
}
