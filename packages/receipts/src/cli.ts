#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createReceipt, signReceipt, verifyReceipt } from "./receipt.js";
import type { ReceiptInput, SignedReceipt } from "./types.js";

async function main(): Promise<void> {
  const [, , command, inputPath, ...args] = process.argv;
  if (!inputPath) { usage(); return; }
  const keyIndex = args.indexOf(command === "create" ? "--private-key" : "--public-key");
  if (keyIndex < 0 || !args[keyIndex + 1]) { usage(); return; }
  const key = await readFile(args[keyIndex + 1] as string);
  if (command === "create") {
    const keyIdIndex = args.indexOf("--key-id");
    const keyId = keyIdIndex >= 0 ? args[keyIdIndex + 1] : undefined;
    if (!keyId) { usage(); return; }
    const input = JSON.parse(await readFile(inputPath, "utf8")) as ReceiptInput;
    console.log(JSON.stringify(signReceipt(createReceipt(input), key, keyId), null, 2));
    return;
  }
  if (command === "verify") {
    const signed = JSON.parse(await readFile(inputPath, "utf8")) as SignedReceipt;
    const valid = verifyReceipt(signed, key);
    console.log(JSON.stringify({ valid, keyId: signed.signature.keyId }, null, 2));
    if (!valid) process.exitCode = 2;
    return;
  }
  usage();
}

function usage(): void {
  console.error("Usage: jev-receipt create <input.json> --private-key <key.pem> --key-id <id> | verify <receipt.json> --public-key <key.pem>");
  process.exitCode = 1;
}

await main();
