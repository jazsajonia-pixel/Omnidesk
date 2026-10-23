import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("CSV export", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Acme, "Inc"')).toBe('"Acme, ""Inc"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });
  it("neutralises spreadsheet formulas", () => {
    for (const value of ["=SUM(A1)", "+1", "-2", "@cmd", "\tx"]) expect(csvCell(value).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(csvCell("plain")).toBe("plain");
  });
  it("renders empty values and dates", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x\r\n");
  });
});
