/** Input for {@link run}. */
export interface RunInput {
  /** The CSV text. A single leading BOM (U+FEFF) is skipped. */
  text: string;
  /**
   * When exactly `true`, the first record becomes `columns` and is not included in `rows`.
   * Any other value (including truthy non-booleans) means "no header".
   */
  header?: boolean;
}

/** Fields common to every error object. */
export interface CsvErrorBase {
  /** Error code. */
  code: string;
  /** 1-based line on which the offending record starts. */
  line: number;
  /**
   * Index in `rows` of the offending record, or `null` when the record is the header.
   * For a line that held only stray CRs (and so produced no record), this is the index
   * the next record will get.
   */
  row: number | null;
}

/** An opening quote with no closing quote; the quote is kept as a literal character. */
export interface UnterminatedQuoteError extends CsvErrorBase {
  code: 'unterminated_quote';
}

/** A CR not followed by LF outside a quoted value; the CR is dropped. */
export interface StrayCrError extends CsvErrorBase {
  code: 'stray_cr';
}

/** Characters after a closing quote (before the next comma / line break); they are appended to the value. */
export interface QuoteJunkError extends CsvErrorBase {
  code: 'quote_junk';
}

/** A record with fewer fields than the first record; it is padded with empty strings. */
export interface ShortRowError extends CsvErrorBase {
  code: 'short_row';
  /** Number of fields the record actually had. */
  fields: number;
}

/** A record with more fields than the first record; the extra fields are removed. */
export interface LongRowError extends CsvErrorBase {
  code: 'long_row';
  /** The fields that were removed from the record. */
  extra: string[];
}

export type CsvError =
  | UnterminatedQuoteError
  | StrayCrError
  | QuoteJunkError
  | ShortRowError
  | LongRowError;

/** Result of {@link run}. */
export interface RunResult {
  /** Header fields when `header` is `true` (`[]` if the text has no records), otherwise `null`. */
  columns: string[] | null;
  /** Data records, each padded/truncated to the width of the first record. */
  rows: string[][];
  /** Problems found while reading, in the order they were met. */
  errors: CsvError[];
}

/** Parse CSV text. Pure: every call starts from nothing and keeps nothing. */
export function run(input: RunInput): RunResult;
