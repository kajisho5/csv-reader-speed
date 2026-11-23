import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../solve.js';

describe('basic records', () => {
  test('plain rows without header', () => {
    assert.deepEqual(run({ text: 'a,b,c\n1,2,3\n' }), {
      columns: null,
      rows: [
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ],
      errors: [],
    });
  });

  test('header: true sets columns and excludes the header from rows', () => {
    assert.deepEqual(run({ text: 'name,age\nAda,36\nBob,41', header: true }), {
      columns: ['name', 'age'],
      rows: [
        ['Ada', '36'],
        ['Bob', '41'],
      ],
      errors: [],
    });
  });

  test('header must be exactly true; other truthy values mean no header', () => {
    // Surprising but intended: the code checks `input.header === true`.
    const r = run({ text: 'a,b\n1,2\n', header: 1 });
    assert.equal(r.columns, null);
    assert.deepEqual(r.rows, [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('trailing newline does not add an empty row', () => {
    const withNl = run({ text: 'a,b\n1,2\n' });
    const withoutNl = run({ text: 'a,b\n1,2' });
    assert.deepEqual(withNl, withoutNl);
    assert.deepEqual(withNl.rows, [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('trailing comma yields an empty last field', () => {
    assert.deepEqual(run({ text: 'a,\nb,c' }).rows, [
      ['a', ''],
      ['b', 'c'],
    ]);
    assert.deepEqual(run({ text: 'a,' }).rows, [['a', '']]);
  });

  test('CRLF line endings', () => {
    assert.deepEqual(run({ text: 'a,b\r\n1,2\r\n' }), {
      columns: null,
      rows: [
        ['a', 'b'],
        ['1', '2'],
      ],
      errors: [],
    });
  });

  test('leading BOM is skipped', () => {
    assert.deepEqual(run({ text: '\uFEFFa,b\n1,2', header: true }), {
      columns: ['a', 'b'],
      rows: [['1', '2']],
      errors: [],
    });
  });

  test('empty lines (LF and CRLF) are skipped, but still counted for line numbers', () => {
    assert.deepEqual(run({ text: 'a,b\n\n1,2\n\r\n3,4\n' }), {
      columns: null,
      rows: [
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ],
      errors: [],
    });
    assert.deepEqual(run({ text: 'a,b\n\n\n1\n' }), {
      columns: null,
      rows: [
        ['a', 'b'],
        ['1', ''],
      ],
      errors: [{ code: 'short_row', line: 4, row: 1, fields: 1 }],
    });
  });
});

describe('quoted fields', () => {
  test('quoted field containing commas', () => {
    assert.deepEqual(run({ text: 'a,"b,c",d\n' }), {
      columns: null,
      rows: [['a', 'b,c', 'd']],
      errors: [],
    });
  });

  test('escaped quotes ("")', () => {
    assert.deepEqual(run({ text: 'x,"a""b"\n' }).rows, [['x', 'a"b']]);
    assert.deepEqual(run({ text: '""""' }).rows, [['"']]);
  });

  test('empty quoted field on its own line is a record, unlike an empty line', () => {
    // Note: `""` alone produces a one-field record [''], whereas an empty line produces no record.
    assert.deepEqual(run({ text: 'a\n""\n\nb\n' }), {
      columns: null,
      rows: [['a'], [''], ['b']],
      errors: [],
    });
  });

  test('quoted field containing LF', () => {
    assert.deepEqual(run({ text: 'a,"line1\nline2",b\nc,d,e\n' }), {
      columns: null,
      rows: [
        ['a', 'line1\nline2', 'b'],
        ['c', 'd', 'e'],
      ],
      errors: [],
    });
  });

  test('line numbers advance across a multi-line quoted field', () => {
    assert.deepEqual(run({ text: 'a,b\n"x\ny",z\nq\n' }), {
      columns: null,
      rows: [
        ['a', 'b'],
        ['x\ny', 'z'],
        ['q', ''],
      ],
      errors: [{ code: 'short_row', line: 4, row: 2, fields: 1 }],
    });
  });

  test('CRLF inside quotes is normalized to LF', () => {
    assert.deepEqual(run({ text: '"x\r\ny",z\n' }), {
      columns: null,
      rows: [['x\ny', 'z']],
      errors: [],
    });
  });

  test('lone CR inside quotes is normalized to LF (no error)', () => {
    assert.deepEqual(run({ text: '"x\ry",z\n' }), {
      columns: null,
      rows: [['x\ny', 'z']],
      errors: [],
    });
  });

  test('CRLF inside quotes counts as one line', () => {
    assert.deepEqual(run({ text: 'a,b\n"x\r\ny",z\nq\n' }).errors, [
      { code: 'short_row', line: 4, row: 2, fields: 1 },
    ]);
  });
});

describe('errors', () => {
  test('unterminated quote: quote kept literally, rest read as unquoted', () => {
    assert.deepEqual(run({ text: 'a,"b\nc,d\n' }), {
      columns: null,
      rows: [
        ['a', '"b'],
        ['c', 'd'],
      ],
      errors: [{ code: 'unterminated_quote', line: 1, row: 0 }],
    });
  });

  test('unterminated quote at end of text', () => {
    assert.deepEqual(run({ text: '"abc' }), {
      columns: null,
      rows: [['"abc']],
      errors: [{ code: 'unterminated_quote', line: 1, row: 0 }],
    });
  });

  test('unterminated quote in the header has row: null', () => {
    assert.deepEqual(run({ text: 'a,"b\n1,2', header: true }), {
      columns: ['a', '"b'],
      rows: [['1', '2']],
      errors: [{ code: 'unterminated_quote', line: 1, row: null }],
    });
  });

  test('junk after a closing quote is appended to the value', () => {
    assert.deepEqual(run({ text: '"ab"cd,e\n' }), {
      columns: null,
      rows: [['abcd', 'e']],
      errors: [{ code: 'quote_junk', line: 1, row: 0 }],
    });
  });

  test('junk containing quotes is appended as it stands', () => {
    // Note: quotes inside the junk are not unescaped.
    assert.deepEqual(run({ text: '"a"b"c",d' }), {
      columns: null,
      rows: [['ab"c"', 'd']],
      errors: [{ code: 'quote_junk', line: 1, row: 0 }],
    });
  });

  test('a stray CR right after a closing quote is dropped and is not quote_junk', () => {
    // Note: only stray_cr is reported, because nothing was actually appended to the value.
    assert.deepEqual(run({ text: '"a"\r,b\n' }), {
      columns: null,
      rows: [['a', 'b']],
      errors: [{ code: 'stray_cr', line: 1, row: 0 }],
    });
    assert.deepEqual(run({ text: '"a"\rx\n' }), {
      columns: null,
      rows: [['ax']],
      errors: [
        { code: 'stray_cr', line: 1, row: 0 },
        { code: 'quote_junk', line: 1, row: 0 },
      ],
    });
  });

  test('stray CR in an unquoted field is dropped', () => {
    assert.deepEqual(run({ text: 'a\rb,c\n' }), {
      columns: null,
      rows: [['ab', 'c']],
      errors: [{ code: 'stray_cr', line: 1, row: 0 }],
    });
  });

  test('a line holding only stray CRs is no record, but its errors remain', () => {
    assert.deepEqual(run({ text: 'a\n\r\r\nb\n' }), {
      columns: null,
      rows: [['a'], ['b']],
      errors: [{ code: 'stray_cr', line: 2, row: 1 }],
    });
  });

  test('ragged rows without header: width comes from the first record', () => {
    assert.deepEqual(run({ text: 'a,b,c\n1,2\n1,2,3,4,5\n' }), {
      columns: null,
      rows: [
        ['a', 'b', 'c'],
        ['1', '2', ''],
        ['1', '2', '3'],
      ],
      errors: [
        { code: 'short_row', line: 2, row: 1, fields: 2 },
        { code: 'long_row', line: 3, row: 2, extra: ['4', '5'] },
      ],
    });
  });

  test('ragged rows with header: width comes from the header', () => {
    assert.deepEqual(run({ text: 'h1,h2\nx\ny,z,w\n', header: true }), {
      columns: ['h1', 'h2'],
      rows: [
        ['x', ''],
        ['y', 'z'],
      ],
      errors: [
        { code: 'short_row', line: 2, row: 0, fields: 1 },
        { code: 'long_row', line: 3, row: 1, extra: ['w'] },
      ],
    });
  });
});

describe('edge inputs', () => {
  test('empty input', () => {
    assert.deepEqual(run({ text: '' }), { columns: null, rows: [], errors: [] });
    assert.deepEqual(run({ text: '', header: true }), { columns: [], rows: [], errors: [] });
  });

  test('input of only line breaks is empty', () => {
    assert.deepEqual(run({ text: '\n\r\n\n' }), { columns: null, rows: [], errors: [] });
    assert.deepEqual(run({ text: '\n\r\n\n', header: true }), { columns: [], rows: [], errors: [] });
  });

  test('input that is only a header', () => {
    const expected = { columns: ['a', 'b', 'c'], rows: [], errors: [] };
    assert.deepEqual(run({ text: 'a,b,c\n', header: true }), expected);
    assert.deepEqual(run({ text: 'a,b,c', header: true }), expected);
  });

  test('run is pure: repeated calls give equal results', () => {
    const input = { text: 'a,"b""c"\n1\n', header: true };
    assert.deepEqual(run(input), run(input));
  });
});
