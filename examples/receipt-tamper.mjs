// Sign a synthetic decision receipt and show that a changed outcome fails verification.
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createReceipt, signReceipt, verifyReceipt} from '../packages/receipts/dist/receipt.js';

const {privateKey, publicKey} = generateKeyPairSync('ed25519');
const input = {
  id: 'synthetic-decision-1',
  createdAt: '2026-10-06T00:00:00.000Z',
  provider: 'offline-fixture',
  request: {ticket: 'fictional-1'},
  decision: {outcome: 'review'},
};
const signed = signReceipt(createReceipt(input), privateKey.export({type: 'pkcs8', format: 'pem'}), 'local-demo');
const publicPem = publicKey.export({type: 'spki', format: 'pem'});
const valid = verifyReceipt(signed, publicPem);
const tampered = verifyReceipt({...signed, receipt: {...signed.receipt, decisionDigest: signed.receipt.requestDigest}}, publicPem);
assert.equal(valid, true);
assert.equal(tampered, false);
console.log(JSON.stringify({source: 'synthetic receipt; ephemeral local key', valid, tampered}, null, 2));
