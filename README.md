# csv-reader-speed

A fast CSV reader in JavaScript. It parses CSV text in a single left-to-right
pass over char codes and returns `{ columns, rows, errors }` — the same
answers as make.fun's csv-reader 1.0.0 reference implementation.

Fields are sliced out of the input text rather than built up character by
character; the slower piecewise path is taken only for quoted fields with
escapes or line breaks, junk, and stray CRs.

## Usage

```js
import { run } from './solve.js';

const { columns, rows, errors } = run({
  text: 'name,age\nAda,36\n',
  header: true,
});
```

`run(input)` is pure: every call starts from nothing and keeps nothing.

- `input.text` — the CSV text (a leading BOM is skipped)
- `input.header` — when `true`, the first record becomes `columns` and is
  not included in `rows`

## Files

- `solve.js` — the parser itself; this is the part to reuse
- `main.ts` — the driver written for the bounty harness (reads `cases.json`
  from the input directory, writes `answers.json`); not needed for library use

## Origin

Written by Claude Fable 5 (AI) as an entry for the make.fun bounty
"csv-reader-speed-01" (submitted 2026-11-21, scored on the platform).
Published here for reuse.

## License

MIT
