/**
 * Minimal RFC 4180 CSV reader for user-uploaded files.
 *
 * Supports quoted fields, escaped `""`, embedded newlines, CRLF and a
 * comma/semicolon delimiter detected from the header line (Excel exports).
 */

const SUPPORTED_DELIMITERS = [',', ';', '\t'] as const;

export interface CsvRecord {
  /** 1-based physical line number of the record start, matching what a spreadsheet shows. */
  line: number;
  values: string[];
}

export interface CsvTable {
  /** Normalized header names: lowercased, with separators stripped (`tg_user_id` -> `tguserid`). */
  headers: string[];
  rows: CsvRecord[];
}

/** Lowercase and strip separators so `tg_user_id`, `tgUserId` and `TG User Id` all collapse. */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^﻿/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]/g, '');
}

/** Pick the delimiter that occurs most often outside quotes on the header line. */
function detectDelimiter(headerLine: string): string {
  let best: string = SUPPORTED_DELIMITERS[0];
  let bestCount = 0;
  for (const candidate of SUPPORTED_DELIMITERS) {
    const count = headerLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function splitRecords(input: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let hasContent = false;

  const pushField = () => {
    values.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push({ line: recordLine, values });
    values = [];
    hasContent = false;
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (!hasContent && char !== '\n' && char !== '\r') {
      recordLine = line;
      hasContent = true;
    }

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      if (char === '\n') line++;
      field += char;
      continue;
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      pushField();
      continue;
    }
    if (char === '\r') continue;
    if (char === '\n') {
      line++;
      // Skip blank lines instead of emitting empty records.
      if (values.length > 0 || field.length > 0) pushRecord();
      continue;
    }
    field += char;
  }

  if (values.length > 0 || field.length > 0) pushRecord();

  return records;
}

/**
 * Parse CSV text into normalized headers plus data rows.
 * Returns `null` when the input has no header line.
 */
export function parseCsv(input: string): CsvTable | null {
  const text = input.replace(/^﻿/, '');
  const firstBreak = text.indexOf('\n');
  const headerLine = firstBreak === -1 ? text : text.slice(0, firstBreak);
  const delimiter = detectDelimiter(headerLine);

  const records = splitRecords(text, delimiter);
  const header = records.shift();
  if (!header) return null;

  return {
    headers: header.values.map(normalizeHeader),
    rows: records,
  };
}

/** Map a record's positional values onto normalized header names. */
export function recordToObject(headers: string[], record: CsvRecord): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (!header) return;
    row[header] = (record.values[index] ?? '').trim();
  });
  return row;
}
