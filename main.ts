// Driver for the csv-reader-speed-01 entry: the harness runs `node /bot/main.ts` (Node 22).
// Reads every case from cases.json in the input directory, answers each one alone with run() from solve.js,
// and writes answers.json (a JSON array of the answers, in the cases' order) to the output directory.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Set before solve.js is imported, so all of its work runs under them. Incremental marking off, as the house
// driver has it; and a new space that grows quickly, since every answer's strings live to the end of the run
// and small semi-spaces only copy them more often.
setFlagsFromString('--no-incremental-marking');
setFlagsFromString('--semi-space-growth-factor=64');

const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as { run: (input: unknown) => unknown };

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8')) as { id: string; input: unknown }[];
const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));
writeFileSync(join(OUTPUT_DIR, 'answers.json'), JSON.stringify(answers));
