export interface UsageRecord {
  inputTokens?: number;
  outputTokens?: number;
  amount?: number;
  currency?: string;
}

export interface DecisionReceipt {
  version: "1";
  id: string;
  createdAt: string;
  requestDigest: string;
  decisionDigest: string;
  provider: string;
  model?: string;
  contractVersion?: string;
  usage?: UsageRecord;
  authority?: { subject: string; capability: string; operationDigest?: string };
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SignedReceipt {
  receipt: DecisionReceipt;
  signature: { algorithm: "Ed25519"; keyId: string; value: string };
}

export interface ReceiptInput {
  id?: string;
  createdAt?: string;
  request: unknown;
  decision: unknown;
  provider: string;
  model?: string;
  contractVersion?: string;
  usage?: UsageRecord;
  authority?: DecisionReceipt["authority"];
  metadata?: DecisionReceipt["metadata"];
}
