# csv-reader-speed

A fast CSV reader in JavaScript. It parses CSV text in a single left-to-right
pass over char codes and returns `{ columns, rows, errors }` — the same
answers as make.fun's csv-reader 1.0.0 reference implementation.

Fields are sliced out of the input text rather than built up character by
character; the slower piecewise path is taken only for quoted fields with
escapes or line breaks, junk, and stray CRs.

No runtime dependencies. ESM only. TypeScript declarations included.

## Install

```sh
npm install csv-reader-speed
```

## Usage

```js
import { run } from 'csv-reader-speed';

const { columns, rows, errors } = run({
  text: 'name,age\nAda,36\n',
  header: true,
});
// columns: ['name', 'age']
// rows:    [['Ada', '36']]
// errors:  []
```

`run(input)` is pure: every call starts from nothing and keeps nothing.

- `input.text` — the CSV text (a leading BOM is skipped)
- `input.header` — when exactly `true`, the first record becomes `columns` and
  is not included in `rows`; otherwise `columns` is `null`

### Reading rules

- Records are separated by LF or CRLF. Lines with no characters produce no record.
- Quoted fields may contain commas, line breaks and `""` (an escaped quote).
  Inside quotes, CRLF and a lone CR each become a single LF.
- Every record is padded with `''` or truncated to the width of the first
  record (the header, if any).

### Errors

Errors never stop parsing. Each has `code`, `line` (1-based line where the
record starts) and `row` (index in `rows`, or `null` for the header).

| code | meaning | extra field |
|---|---|---|
| `unterminated_quote` | opening quote never closed; the quote is kept as a literal and the rest is read unquoted | — |
| `quote_junk` | characters after a closing quote; they are appended to the value | — |
| `stray_cr` | a CR not followed by LF outside quotes; it is dropped | — |
| `short_row` | fewer fields than the first record; padded with `''` | `fields` (count before padding) |
| `long_row` | more fields than the first record; extras removed | `extra` (the removed fields) |

## Benchmarks

Measured with `npm run bench` (deterministic in-memory fixtures; median of 5
runs after 1 warmup; compared with PapaParse).

| Fixture | Parser | median ms | MB/s |
|---|---|---:|---:|
| plain | csv-reader-speed | 34.91 | 94.5 |
| plain | papaparse | 128.28 | 25.7 |
| quoted | csv-reader-speed | 27.42 | 104.0 |
| quoted | papaparse | 125.77 | 22.7 |

Fixtures: plain = 100,000 rows × 6 short columns, no quotes (3.30 MB);
quoted = 50,000 rows × 6 columns, every field quoted (2.85 MB).
Measured 2026-11-23 on a shared-CPU Linux VM, Node v24.22.1. Absolute
numbers vary by machine; across repeated runs the gap against PapaParse
was roughly 3–4.5×.

## Development

```sh
npm install      # installs papaparse (dev dependency, benchmark only)
npm test         # runs the node:test suite in test/
npm run bench    # runs bench/bench.mjs
```

## Files

- `solve.js` — the parser itself; this is what the package exports
- `index.d.ts` — TypeScript declarations
- `main.ts` — the driver written for the bounty harness (reads `cases.json`
  from the input directory, writes `answers.json`); in the repository only,
  not needed for library use and not published

## Origin

Written by Claude Fable 5 (AI) as an entry for the make.fun bounty
"csv-reader-speed-01" (submitted 2026-11-21, scored on the platform).
Published here for reuse.

## License

MIT
