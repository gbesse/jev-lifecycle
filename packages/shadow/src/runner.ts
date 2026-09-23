import { createHash, randomUUID } from "node:crypto";
import { agreementRate, compareDecisions } from "./compare.js";
import type { DecisionProvider, ProviderResult, ShadowEvent, ShadowOptions } from "./types.js";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sampled(traceId: string, rate: number): boolean {
  const bucket = Number.parseInt(hash(traceId).slice(0, 8), 16) / 0xffffffff;
  return bucket < rate;
}

async function timed<T>(operation: () => Promise<T>): Promise<{ ok: true; value: T; latencyMs: number } | { ok: false; error: Error; latencyMs: number }> {
  const started = performance.now();
  try {
    return { ok: true, value: await operation(), latencyMs: performance.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)), latencyMs: performance.now() - started };
  }
}

function safeError(error: Error): string {
  return error.name || "ProviderError";
}

export async function runShadow<TInput>(input: TInput, primary: DecisionProvider<TInput>, shadow: DecisionProvider<TInput>, options: ShadowOptions = {}): Promise<{ primary: ProviderResult; comparison: Promise<ShadowEvent> }> {
  const traceId = options.traceId ?? randomUUID();
  const rate = options.sampleRate ?? 1;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("sampleRate must be between 0 and 1");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  timer.unref();
  const primaryPromise = timed(() => primary(input, controller.signal));
  const isSampled = sampled(traceId, rate);
  const shadowPromise = isSampled ? timed(() => shadow(input, controller.signal)) : Promise.resolve(undefined);
  const primaryTimed = await primaryPromise;
  if (!primaryTimed.ok) {
    clearTimeout(timer);
    throw primaryTimed.error;
  }
  const comparison = (async (): Promise<ShadowEvent> => {
    const shadowTimed = await shadowPromise;
    clearTimeout(timer);
    const base: ShadowEvent = {
      schemaVersion: 1,
      id: randomUUID(),
      traceId,
      timestamp: new Date().toISOString(),
      inputHash: hash(input),
      sampled: isSampled,
      primary: { ok: true, latencyMs: primaryTimed.latencyMs, ...(primaryTimed.value.envelope.model ? { model: primaryTimed.value.envelope.model } : {}) },
      shadow: { ok: false, latencyMs: 0, error: isSampled ? "Unavailable" : "NotSampled" },
      diffs: [],
    };
    if (shadowTimed?.ok) {
      const diffs = compareDecisions(primaryTimed.value.envelope, shadowTimed.value.envelope);
      base.shadow = { ok: true, latencyMs: shadowTimed.latencyMs, ...(shadowTimed.value.envelope.model ? { model: shadowTimed.value.envelope.model } : {}) };
      base.diffs = diffs;
      base.agreement = agreementRate(diffs);
    } else if (shadowTimed && !shadowTimed.ok) {
      base.shadow = { ok: false, latencyMs: shadowTimed.latencyMs, error: safeError(shadowTimed.error) };
    }
    await options.onEvent?.(base);
    return base;
  })();
  return { primary: primaryTimed.value, comparison };
}
