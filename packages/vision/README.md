# @gbesse/jev-vision

A provider-neutral contract for typed decisions over screenshots, images, and video references. Requests and provider outputs are validated on both sides of the bridge, so an engine cannot silently return an option outside the question contract.

```ts
import { decideVision, OpenAICompatibleVisionProvider } from "@gbesse/jev-vision";

const provider = new OpenAICompatibleVisionProvider({
  endpoint: "https://gateway.example/v1/chat/completions",
  apiKey: process.env.VISION_API_KEY!,
  model: "vision-model"
});

const decision = await decideVision(provider, request, { timeoutMs: 20_000 });
```

```bash
jev-vision validate request.json
```

Only HTTPS or image/video data URLs are accepted. The bundled OpenAI-compatible adapter supports images and screenshots; plug in a `VisionProvider` implementation for native video models. API keys are accepted only as runtime constructor values and are never logged.
