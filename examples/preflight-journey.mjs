// Compose three offline lifecycle checks into a compact preflight receipt.
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function cli(packageName, args) {
  return execFileSync(process.execPath, [resolve(root, `packages/${packageName}/dist/cli.js`), ...args], {cwd: root, encoding: 'utf8'});
}
const context = JSON.parse(cli('context', ['shape', 'examples/context-entries.json']));
const runtime = JSON.parse(cli('runtime', ['inspect', 'examples/runtime-request.json']));
const router = cli('router', ['check', '--config', 'examples/router-config.json']).trim();
const redacted = context.state.customer?.email === '[REDACTED_EMAIL]';
if (!redacted || !runtime.ok || !runtime.budget.accepted || !router.startsWith('valid:')) {
  throw new Error('Synthetic preflight did not satisfy its checks');
}
console.log(JSON.stringify({
  source: 'synthetic fixtures; no provider call',
  contextRedacted: redacted,
  contextTokenEstimate: context.estimatedTokens,
  runtimeAccepted: runtime.budget.accepted,
  router,
}, null, 2));
