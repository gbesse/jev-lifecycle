import { createHash } from "node:crypto";
import type { JsonValue, PreflightIssue } from "./types.js";

export class UnsafeJsonError extends TypeError {
  constructor(readonly issues: PreflightIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "UnsafeJsonError";
  }
}

export function inspectJson(value: unknown): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const ancestors = new Set<object>();

  function visit(current: unknown, path: string): void {
    if (current === null || typeof current === "string" || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) issues.push({ code: "NON_FINITE_NUMBER", path, severity: "error", message: "Non-finite numbers are silently changed by JSON.stringify." });
      return;
    }
    if (["undefined", "bigint", "function", "symbol"].includes(typeof current)) {
      issues.push({ code: "NON_JSON_VALUE", path, severity: "error", message: `Values of type ${typeof current} are not JSON-safe.` });
      return;
    }
    if (typeof current !== "object") return;
    if (ancestors.has(current)) {
      issues.push({ code: "CIRCULAR_REFERENCE", path, severity: "error", message: "Circular references cannot be serialized." });
      return;
    }
    ancestors.add(current);
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${path}[${index}]`));
    } else {
      const prototype = Object.getPrototypeOf(current) as object | null;
      if (prototype !== Object.prototype && prototype !== null) {
        issues.push({ code: "NON_PLAIN_OBJECT", path, severity: "error", message: "Only plain objects are accepted in the wire payload." });
      } else {
        for (const [key, entry] of Object.entries(current)) visit(entry, `${path}.${key}`);
      }
    }
    ancestors.delete(current);
  }

  visit(value, "$");
  return issues;
}

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key] as JsonValue)]));
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  const issues = inspectJson(value);
  if (issues.length > 0) throw new UnsafeJsonError(issues);
  return JSON.stringify(sortJson(value as JsonValue));
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}
