import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readCsv(filename: string): Array<Record<string, string>> {
  const file = readFileSync(join(process.cwd(), "src", "backend", "data", filename), "utf8").trim();
  const [headerLine, ...rows] = file.split(/\r?\n/);
  const headers = headerLine.split(",").map((value) => value.trim());

  return rows.filter(Boolean).map((row) => {
    const values = row.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function numberValue(row: Record<string, string>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric value for ${key}`);
  return value;
}
