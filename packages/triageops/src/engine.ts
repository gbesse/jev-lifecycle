import { createHash, randomUUID } from "node:crypto";
import type { ChoiceAnswer, Json, NoulAnswer, ScoreAnswer, Ticket, TriageAnswers, TriagePolicy, TriageProvider, TriageResult } from "./types.js";
import { validatePolicy } from "./policy.js";

function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function finiteUnit(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 1; }

function validateDistribution(values: Record<string, number>, expected?: string[]): void {
  if (expected && expected.some((key) => !(key in values))) throw new Error("response distribution is missing an expected option");
  if (expected && Object.keys(values).some((key) => !expected.includes(key))) throw new Error("response distribution contains an unexpected option");
  if (Object.values(values).some((value) => !finiteUnit(value))) throw new Error("response contains an invalid probability");
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.001) throw new Error("response probabilities do not sum to one");
}

function validateAnswers(answers: TriageAnswers, teams: string[]): void {
  const team = answers.team as ChoiceAnswer;
  if (team.type !== "choice" || !teams.includes(team.choice) || !finiteUnit(team.confidence)) throw new Error("invalid team answer");
  validateDistribution(team.probabilities, teams);
  const urgency = answers.urgency as ScoreAnswer;
  if (urgency.type !== "score" || !Number.isFinite(urgency.score) || !finiteUnit(urgency.confidence)) throw new Error("invalid urgency answer");
  validateDistribution(urgency.probabilities, ["0", "1", "2"]);
  for (const answer of [answers.refund, answers.abuse] as NoulAnswer[]) if (answer.type !== "noul" || !finiteUnit(answer.noul)) throw new Error("invalid Noul answer");
}

function ticketState(ticket: Ticket, derived: { ageHours: number; highValue: boolean; stale: boolean }): Json {
  return {
    ticket: {
      subject: ticket.subject ?? "",
      messages: ticket.messages.map((message) => ({ author: message.author, text: message.text })),
      customer: ticket.customer ?? {},
      metadata: ticket.metadata ?? {},
    },
    deterministic: derived,
  } as Json;
}

export function buildQuestions(policy: TriagePolicy): Record<string, Json> {
  return {
    team: { type: "choice", instructions: "Which single team should primarily handle the customer's request? Use review when evidence is insufficient or several teams are equally necessary.", criteria: policy.teams },
    urgency: { type: "score", instructions: "How operationally urgent is the customer's request based only on the message content?", criteria: ["Routine", "Time-sensitive", "Service blocked or immediate harm likely"] },
    refund: { type: "noul", instructions: "Is the customer explicitly requesting a refund or reversal?", criteria: { true: "A refund or reversal is directly requested", false: "No direct refund or reversal request" } },
    abuse: { type: "noul", instructions: "Does the customer message contain targeted abuse or a credible threat?", criteria: { true: "Targeted abuse or credible threat is present", false: "No targeted abuse or credible threat" } },
  } as Json as Record<string, Json>;
}

export async function triageTicket(ticket: Ticket, policy: TriagePolicy, provider: TriageProvider, options: { now?: Date; signal?: AbortSignal } = {}): Promise<TriageResult> {
  const policyErrors = validatePolicy(policy);
  if (policyErrors.length) throw new Error(`invalid policy: ${policyErrors.join(", ")}`);
  if (!ticket.id?.trim() || !ticket.messages.length) throw new Error("ticket id and messages are required");
  const textLength = ticket.messages.reduce((sum, message) => sum + message.text.length, 0);
  if (textLength > (policy.maxTextCharacters ?? 50_000)) throw new Error("ticket text exceeds configured maximum");
  const now = options.now ?? new Date();
  const received = new Date(ticket.receivedAt);
  if (Number.isNaN(received.getTime()) || received > now) throw new Error("receivedAt must be a valid past timestamp");
  const ageHours = (now.getTime() - received.getTime()) / 3_600_000;
  const derived = { ageHours, highValue: ticket.amount !== undefined && ticket.amount >= (policy.highValueAmount ?? Number.POSITIVE_INFINITY), stale: ageHours >= (policy.staleAfterHours ?? Number.POSITIVE_INFINITY) };
  const state = ticketState(ticket, derived);
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const response = await provider({ state, model: policy.model, questions: buildQuestions(policy) }, signal);
  validateAnswers(response.answers, Object.keys(policy.teams));
  const reasons: string[] = [];
  if (response.answers.team.confidence < policy.minTeamConfidence) reasons.push("low-team-confidence");
  if (response.answers.urgency.confidence < policy.minUrgencyConfidence) reasons.push("low-urgency-confidence");
  if (derived.highValue && response.answers.refund.noul >= 0.5) reasons.push("high-value-refund");
  if (response.answers.abuse.noul >= 0.8) reasons.push("abuse-or-threat");
  if (response.answers.team.choice === policy.reviewTeam) reasons.push("model-selected-review");
  const reviewRequired = reasons.length > 0;
  const decision = { team: response.answers.team.choice, urgency: response.answers.urgency.score, refundProbability: response.answers.refund.noul, abuseProbability: response.answers.abuse.noul };
  return {
    schemaVersion: 1,
    id: randomUUID(),
    ticketId: ticket.id,
    timestamp: now.toISOString(),
    policy: policy.name,
    policyVersion: 1,
    model: response.model,
    inputHash: hash(state),
    derived,
    decision,
    action: { route: reviewRequired ? policy.reviewTeam : decision.team, reviewRequired, committed: policy.mode === "active" && !reviewRequired, reasons },
    confidence: { team: response.answers.team.confidence, urgency: response.answers.urgency.confidence },
    usage: { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 },
  };
}
