/**
 * Build RFC 4180 CSV. Cells that a spreadsheet would treat as a formula
 * (starting with =, +, -, @, tab or carriage return) are prefixed with a
 * single quote to prevent CSV/formula injection.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) text = "\"" + text.replace(/"/g, "\"\"") + "\"";
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
