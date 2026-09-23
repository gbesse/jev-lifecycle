export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type Ticket = {
  id: string;
  subject?: string;
  messages: Array<{ author: "customer" | "agent" | "system"; text: string; at?: string }>;
  receivedAt: string;
  amount?: number;
  currency?: string;
  customer?: { id?: string; tier?: string; locale?: string };
  metadata?: Record<string, Json>;
};

export type TriagePolicy = {
  version: 1;
  name: string;
  model: string;
  mode: "shadow" | "active";
  teams: Record<string, string>;
  minTeamConfidence: number;
  minUrgencyConfidence: number;
  highValueAmount?: number;
  staleAfterHours?: number;
  maxTextCharacters?: number;
  reviewTeam: string;
};

export type ChoiceAnswer = { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number };
export type ScoreAnswer = { type: "score"; score: number; probabilities: Record<string, number>; confidence: number; legend?: Record<string, string> };
export type NoulAnswer = { type: "noul"; noul: number };
export type TriageAnswers = { team: ChoiceAnswer; urgency: ScoreAnswer; refund: NoulAnswer; abuse: NoulAnswer };

export type TriageProvider = (request: { state: Json; model: string; questions: Record<string, Json> }, signal: AbortSignal) => Promise<{ model: string; answers: TriageAnswers; usage?: { input_tokens?: number; output_tokens?: number } }>;

export type TriageResult = {
  schemaVersion: 1;
  id: string;
  ticketId: string;
  timestamp: string;
  policy: string;
  policyVersion: 1;
  model: string;
  inputHash: string;
  derived: { ageHours: number; highValue: boolean; stale: boolean };
  decision: { team: string; urgency: number; refundProbability: number; abuseProbability: number };
  action: { route: string; reviewRequired: boolean; committed: boolean; reasons: string[] };
  confidence: { team: number; urgency: number };
  usage: { inputTokens: number; outputTokens: number };
};

export type ReviewRecord = {
  id: string;
  ticketId: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "corrected";
  proposed: TriageResult["decision"];
  reasons: string[];
  resolution?: { at: string; actor: string; team?: string; note?: string };
};
