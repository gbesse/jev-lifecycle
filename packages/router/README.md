# @gbesse/jev-router

A provider-neutral router for bounded Jev-compatible decisions. It handles large registries with hierarchical choices, fails over between local or hosted providers, gates low-confidence decisions, detects repeated-action loops, and always returns a proposal that still requires deterministic authorization.

```bash
npm install @gbesse/jev-router
npx jev-router check --config router.json
TYPESAFE_API_KEY=... npx jev-router route --config router.json --state state.json
```

The key belongs in the environment named by `apiKeyEnv`, never in the JSON file. HTTPS is mandatory except for loopback endpoints, so a local model gateway or hosted Jev endpoint can share the same boundary.

```ts
import { JevRouter, authorizeRoute, createJevHttpProvider } from "@gbesse/jev-router";

const router = new JevRouter(config, [
  createJevHttpProvider({
    name: "primary",
    endpoint: "https://api.typesafe.ai/v1/systemone",
  }, process.env.TYPESAFE_API_KEY),
  localProvider,
]);

const proposal = await router.route(state, { history: recentRoutes });
// proposal.authorization is always { state: "required", authorized: false }
const authorization = authorizeRoute(proposal, (route) => policy.evaluate(route));
```

## Behavior

- User-defined groups and automatically bounded chunks keep each choice set at or below `maxChoices`.
- Providers are tried in order after transport errors, invalid response envelopes, or—by default—low confidence.
- Distributions must contain exactly the offered candidates, sum to one, and keep the declared choice within 0.011 of the numeric argmax.
- `fallbackRoute` is proposed for low confidence, provider exhaustion, and loops. Without one the router abstains.
- A route repeated `maxRepeatedSelection` times inside `historyWindow` is treated as a loop.
- Trace data contains candidate identifiers, scores, model and provider, but never raw state or credentials.

The router does not generate arguments, invoke tools, mutate data, or convert confidence into permission. Those are separate planner, executor, and authorization responsibilities.
