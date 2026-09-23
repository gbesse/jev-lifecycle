import { createHash } from "node:crypto";
import type { Json } from "./types.js";

export function canonicalize(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

export function fingerprint(value: Json): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}
