// A fast reading of CSV text with the same answers as make.fun's csv-reader 1.0.0: {columns, rows, errors}.
// One left-to-right pass over char codes; fields are sliced out of the text rather than built up, and the
// piecewise path (prefix + slices) is taken only for quotes with escapes or line breaks, junk and stray CRs.
// Pure: every call starts from nothing and keeps nothing.

const QUOTE = 34;
const COMMA = 44;
const LF = 10;
const CR = 13;

/** The answer for one case's input, {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = n > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let c = 0;

  outer: for (;;) {
    // Lines with no characters are no records.
    for (;;) {
      if (pos >= n) break outer;
      c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && pos + 1 < n && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else break;
    }

    const recordLine = line;
    const isHeader = header && columns === null;
    const recordRow = isHeader ? null : rows.length;
    const fields = [];
    let quoted = false;

    for (;;) {
      // One field, starting at pos. The unquoted scan below runs from i; the field is prefix + text[seg, i).
      let i = pos;
      let seg = pos;
      let prefix = '';
      let pieces = false; // whether prefix is in use
      let junkBase = -1; // the closed quoted value's length when junk may follow it, else -1
      quoted = pos < n && text.charCodeAt(pos) === QUOTE;

      if (quoted) {
        let j = pos + 1;
        let s = j;
        let ln = line;
        let val = '';
        let closed = false;
        for (; j < n; j++) {
          c = text.charCodeAt(j);
          if (c === QUOTE) {
            if (j + 1 < n && text.charCodeAt(j + 1) === QUOTE) {
              val += text.slice(s, j + 1);
              j += 1;
              s = j + 1;
              continue;
            }
            closed = true;
            break;
          }
          if (c === LF) ln += 1;
          else if (c === CR) {
            // CRLF and a lone CR inside quotes are each one LF.
            val += text.slice(s, j) + '\n';
            ln += 1;
            if (j + 1 < n && text.charCodeAt(j + 1) === LF) j += 1;
            s = j + 1;
          }
        }
        if (!closed) {
          // The quote is a literal character; the text after it is read as unquoted (line unchanged).
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          i = pos + 1;
        } else {
          val = s === pos + 1 ? text.slice(s, j) : val + text.slice(s, j);
          line = ln;
          pos = j + 1;
          if (pos >= n) {
            fields.push(val);
            break;
          }
          c = text.charCodeAt(pos);
          if (c === COMMA) {
            fields.push(val);
            pos += 1;
            continue;
          }
          if (c === LF) {
            fields.push(val);
            pos += 1;
            line += 1;
            break;
          }
          if (c === CR && pos + 1 < n && text.charCodeAt(pos + 1) === LF) {
            fields.push(val);
            pos += 2;
            line += 1;
            break;
          }
          // Junk after the closing quote is appended as it stands.
          prefix = val;
          pieces = true;
          junkBase = val.length;
          i = pos;
          seg = pos;
        }
      }

      // Unquoted scan to the next comma, line break or the end of the text.
      let ended = 0; // 0 end of text, 1 comma, 2 LF, 3 CRLF
      while (i < n) {
        c = text.charCodeAt(i);
        if (c > COMMA) {
          i += 1;
          continue;
        }
        if (c === COMMA) {
          ended = 1;
          break;
        }
        if (c === LF) {
          ended = 2;
          break;
        }
        if (c === CR) {
          if (i + 1 < n && text.charCodeAt(i + 1) === LF) {
            ended = 3;
            break;
          }
          // A stray CR is dropped.
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          prefix += text.slice(seg, i);
          pieces = true;
          seg = i + 1;
        }
        i += 1;
      }

      const value = pieces ? prefix + text.slice(seg, i) : text.slice(seg, i);
      if (junkBase >= 0 && value.length > junkBase) {
        errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      }
      fields.push(value);
      if (ended === 1) {
        pos = i + 1;
        continue;
      }
      if (ended === 0) pos = i;
      else {
        pos = ended === 2 ? i + 1 : i + 2;
        line += 1;
      }
      break;
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && !quoted && fields[0] === '') continue;

    if (width < 0) width = fields.length;
    if (isHeader) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

// Warm-up at import: read a few tiny synthetic texts that walk every branch above (both string widths, with and
// without a header), so V8 has type feedback for the rare paths before the first case and does not throw its
// optimised code away each time a case first meets one. Nothing is kept: run() holds no state between calls.
{
  const body =
    'a,b,c\r\nd,"e,1",f\n\n\r\n"g""h","i\rj\r\nk\nl",m\n"n"o,p\rq,"r"\r\n"s"\rt\n' +
    'u\n\r\r\nv,w,x,y\r\n"",,"z"\n"1"\r,"2""",3\n\r\n\rr\r,4,5\n""\n6,7,"8"\r\n9,"0';
  const texts = [body, '\uFEFF' + body + '"', body + ',é,"東"\n,', '\uFEFFé,ü\r\n' + body + '\r', 'a,b\n1,2\n', '', '"a",'];
  for (let k = 0; k < 24; k++) {
    for (let t = 0; t < texts.length; t++) {
      run({ text: texts[t], header: true });
      run({ text: texts[t], header: false });
    }
  }
}
