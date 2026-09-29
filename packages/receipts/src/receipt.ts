import { createHash, createPrivateKey, createPublicKey, randomUUID, sign, verify } from "node:crypto";
import type { DecisionReceipt, ReceiptInput, SignedReceipt } from "./types.js";

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("Receipt values must contain only finite numbers."); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new TypeError(`Receipt values cannot contain ${typeof value}.`);
}

export function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

function validateReceipt(receipt: DecisionReceipt): void {
  if (!receipt.id.trim() || !receipt.provider.trim()) throw new TypeError("Receipt id and provider are required.");
  if (!Number.isFinite(Date.parse(receipt.createdAt))) throw new TypeError("Receipt createdAt must be an ISO date.");
  if (!/^sha256:[a-f0-9]{64}$/.test(receipt.requestDigest) || !/^sha256:[a-f0-9]{64}$/.test(receipt.decisionDigest)) throw new TypeError("Receipt digests must be sha256 values.");
  const sensitive = Object.keys(receipt.metadata ?? {}).find((key) => /secret|token|password|api.?key/i.test(key));
  if (sensitive) throw new TypeError(`Sensitive metadata key is not allowed: ${sensitive}`);
  for (const value of [receipt.usage?.inputTokens, receipt.usage?.outputTokens, receipt.usage?.amount]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new TypeError("Receipt usage values must be finite and non-negative.");
  }
  if (receipt.usage?.currency !== undefined && !/^[A-Z]{3}$/.test(receipt.usage.currency)) throw new TypeError("Receipt currency must be a three-letter uppercase code.");
}

export function createReceipt(input: ReceiptInput): DecisionReceipt {
  const receipt: DecisionReceipt = {
    version: "1",
    id: input.id ?? randomUUID(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    requestDigest: digest(input.request),
    decisionDigest: digest(input.decision),
    provider: input.provider,
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.contractVersion !== undefined ? { contractVersion: input.contractVersion } : {}),
    ...(input.usage !== undefined ? { usage: input.usage } : {}),
    ...(input.authority !== undefined ? { authority: input.authority } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
  };
  validateReceipt(receipt);
  return receipt;
}

export function signReceipt(receipt: DecisionReceipt, privateKeyPem: string | Buffer, keyId: string): SignedReceipt {
  validateReceipt(receipt);
  if (!keyId.trim()) throw new TypeError("keyId is required.");
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new TypeError("Only Ed25519 private keys are accepted.");
  const signature = sign(null, Buffer.from(canonical(receipt)), key).toString("base64url");
  return { receipt, signature: { algorithm: "Ed25519", keyId, value: signature } };
}

export function verifyReceipt(signed: SignedReceipt, publicKeyPem: string | Buffer): boolean {
  try {
    validateReceipt(signed.receipt);
    if (signed.signature.algorithm !== "Ed25519" || !signed.signature.keyId) return false;
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== "ed25519") return false;
    return verify(null, Buffer.from(canonical(signed.receipt)), key, Buffer.from(signed.signature.value, "base64url"));
  } catch {
    return false;
  }
}
