/**
 * RFC 4180 CSV for the files the bot sends as documents.
 * Column names stay in English: the file is read by ad managers and spreadsheets,
 * not by a person, so it must not change with the interface language.
 */

/** Excel only detects UTF-8 when the file starts with a byte order mark. */
const BOM = '\uFEFF';
const DELIMITER = ',';
const LINE_END = '\r\n';
const QUOTE = '"';

/** Leading characters a spreadsheet would evaluate as a formula. */
const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Quote a value and neutralise spreadsheet formula injection: a label the user typed
 * must never be executed by whatever opens the export.
 */
export function csvCell(value: string | null | undefined): string {
  const text = value ?? '';
  const safe = FORMULA_STARTERS.some((starter) => text.startsWith(starter)) ? `'${text}` : text;
  return `${QUOTE}${safe.replaceAll(QUOTE, QUOTE + QUOTE)}${QUOTE}`;
}

export function csvDocument(header: string[], rows: (string | null | undefined)[][]): string {
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(DELIMITER));
  return BOM + lines.join(LINE_END) + LINE_END;
}

const FILE_SLUG_MAX = 40;

/** Channel titles become file names, so anything a file system dislikes is dropped. */
export function fileSlug(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, FILE_SLUG_MAX);
  return slug.length > 0 ? slug : fallback;
}
