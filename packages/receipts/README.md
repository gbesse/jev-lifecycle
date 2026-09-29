# @gbesse/jev-receipts

Create tamper-evident decision receipts with canonical SHA-256 digests and Ed25519 signatures. Raw request and decision contents are not embedded: the receipt records their digests, provenance, optional usage, and explicit authority information.

```ts
import { createReceipt, signReceipt, verifyReceipt } from "@gbesse/jev-receipts";

const receipt = createReceipt({ request, decision, provider: "jev", contractVersion: "3" });
const signed = signReceipt(receipt, privateKeyPem, "prod-2026-09");
verifyReceipt(signed, publicKeyPem);
```

```bash
jev-receipt create input.json --private-key private.pem --key-id prod-2026-09 > receipt.json
jev-receipt verify receipt.json --public-key public.pem
```

Private keys are read locally and are never written to output. Protect key files with operating-system permissions or a hardware-backed signer in production. A valid receipt proves integrity and key possession, not that the decision was correct or authorized by policy.
