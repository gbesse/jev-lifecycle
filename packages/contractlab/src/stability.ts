import type {
  ComparableAnswer,
  DecisionContract,
  DecisionResponse,
  Json,
  Question,
  StabilityObservation,
  StabilityProvider,
  StabilityQuestionReport,
  StabilityReport,
} from "./types.js";

function unit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function choiceOf(answer: ComparableAnswer | undefined): string | undefined {
  return answer?.type === "choice" && typeof answer.choice === "string" ? answer.choice : undefined;
}

function distributionOf(answer: ComparableAnswer | undefined): Record<string, number> | undefined {
  if (answer?.type !== "choice" || !answer.probabilities) return undefined;
  const values = Object.values(answer.probabilities);
  if (!values.length || values.some((value) => !unit(value))) return undefined;
  return answer.probabilities;
}

function rate(values: string[]): { choice: string | null; rate: number | null } {
  if (!values.length) return { choice: null, rate: null };
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const sorted = [...counts].sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b));
  return { choice: sorted[0]?.[0] ?? null, rate: (sorted[0]?.[1] ?? 0) / values.length };
}

function maxDistributionDelta(distributions: Record<string, number>[]): number {
  let maximum = 0;
  const keys = new Set(distributions.flatMap((distribution) => Object.keys(distribution)));
  for (const key of keys) {
    const values = distributions.map((distribution) => distribution[key] ?? 0);
    maximum = Math.max(maximum, Math.max(...values) - Math.min(...values));
  }
  return maximum;
}

export function analyzeStability(observations: StabilityObservation[], options: { tolerance?: number } = {}): StabilityReport {
  const tolerance = options.tolerance ?? 0.011;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1) throw new Error("tolerance must be between 0 and 1");
  if (!observations.length) throw new Error("at least one stability observation is required");
  const questionNames = new Set(observations.flatMap((observation) => Object.entries(observation.response.answers)
    .filter(([, answer]) => answer.type === "choice")
    .map(([name]) => name)));
  if (!questionNames.size) throw new Error("at least one choice observation is required");
  const questions: Record<string, StabilityQuestionReport> = {};
  for (const question of [...questionNames].sort()) {
    const entries = observations.map((observation) => ({ observation, answer: observation.response.answers[question] }));
    for (const { answer } of entries) {
      const selected = choiceOf(answer);
      const distribution = distributionOf(answer);
      if (!selected || !distribution || distribution[selected] === undefined) throw new Error(`question ${question} has an invalid choice observation`);
      if (Math.abs(Object.values(distribution).reduce((sum, value) => sum + value, 0) - 1) > 0.011) throw new Error(`question ${question} probabilities do not sum to one`);
    }
    const choices = entries.map(({ answer }) => choiceOf(answer)).filter((value): value is string => value !== undefined);
    const consensus = rate(choices);
    const baselineChoices = entries.filter(({ observation }) => observation.kind === "baseline").map(({ answer }) => choiceOf(answer)).filter((value): value is string => value !== undefined);
    const baseline = rate(baselineChoices);
    const permutationChoices = entries.filter(({ observation }) => observation.kind === "permutation").map(({ answer }) => choiceOf(answer)).filter((value): value is string => value !== undefined);
    let strictArgmaxMismatches = 0;
    let materialArgmaxMismatches = 0;
    let maximumArgmaxGap = 0;
    const distributions: Record<string, number>[] = [];
    for (const { answer } of entries) {
      const choice = choiceOf(answer);
      const distribution = distributionOf(answer);
      if (!choice || !distribution || distribution[choice] === undefined) continue;
      distributions.push(distribution);
      const maximum = Math.max(...Object.values(distribution));
      const gap = maximum - distribution[choice];
      maximumArgmaxGap = Math.max(maximumArgmaxGap, gap);
      if (gap > 1e-12) strictArgmaxMismatches += 1;
      if (gap > tolerance) materialArgmaxMismatches += 1;
    }
    questions[question] = {
      question,
      runs: choices.length,
      consensusChoice: consensus.choice,
      consensusRate: consensus.rate,
      fixedOrderFlipRate: baseline.rate === null ? null : 1 - baseline.rate,
      permutationFlipRate: !permutationChoices.length || baseline.choice === null
        ? null
        : permutationChoices.filter((choice) => choice !== baseline.choice).length / permutationChoices.length,
      strictArgmaxMismatches,
      materialArgmaxMismatches,
      maximumArgmaxGap,
      maximumProbabilityDelta: distributions.length ? maxDistributionDelta(distributions) : 0,
    };
  }
  return {
    schemaVersion: 1,
    runs: observations.length,
    tolerance,
    stable: Object.values(questions).every((question) => question.fixedOrderFlipRate === 0 && question.permutationFlipRate === 0 && question.materialArgmaxMismatches === 0),
    questions,
  };
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(items: T[], next: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));
    [result[index], result[other]] = [result[other] as T, result[index] as T];
  }
  return result;
}

export function createPermutationCases(contract: DecisionContract, count: number, seed = 1): Array<{ id: string; questions: Record<string, Question> }> {
  if (!Number.isInteger(count) || count < 0 || count > 1_000) throw new Error("count must be an integer between 0 and 1000");
  const next = random(seed);
  return Array.from({ length: count }, (_, index) => {
    const questions = Object.fromEntries(Object.entries(contract.questions).map(([name, question]) => {
      if (question.type !== "choice") return [name, structuredClone(question)];
      return [name, { ...structuredClone(question), criteria: Object.fromEntries(shuffled(Object.entries(question.criteria), next)) }];
    }));
    return { id: `permutation-${index + 1}`, questions };
  });
}

export async function runStabilityLab(
  contract: DecisionContract,
  state: Json,
  provider: StabilityProvider,
  options: { repetitions?: number; permutations?: number; seed?: number; tolerance?: number; signal?: AbortSignal } = {},
): Promise<{ observations: StabilityObservation[]; report: StabilityReport }> {
  const repetitions = options.repetitions ?? 3;
  const permutations = options.permutations ?? 5;
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) throw new Error("repetitions must be an integer between 1 and 100");
  const cases = [
    { id: "baseline", kind: "baseline" as const, questions: structuredClone(contract.questions) },
    ...createPermutationCases(contract, permutations, options.seed).map((item) => ({ ...item, kind: "permutation" as const })),
  ];
  const signal = options.signal ?? new AbortController().signal;
  const observations: StabilityObservation[] = [];
  for (const item of cases) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      if (signal.aborted) throw signal.reason;
      const response: DecisionResponse = await provider({ state, model: contract.model, questions: item.questions }, signal);
      observations.push({ caseId: item.id, kind: item.kind, repetition, response });
    }
  }
  return { observations, report: analyzeStability(observations, options.tolerance === undefined ? {} : { tolerance: options.tolerance }) };
}
