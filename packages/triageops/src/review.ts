import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ReviewRecord, TriageResult } from "./types.js";

type ReviewEvent = { type: "created"; record: ReviewRecord } | { type: "resolved"; id: string; resolution: NonNullable<ReviewRecord["resolution"]>; status: ReviewRecord["status"] };

export class JsonlReviewStore {
  constructor(readonly path: string) {}

  private async append(event: ReviewEvent): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  }

  async create(result: TriageResult): Promise<ReviewRecord> {
    const existing = (await this.list()).find((record) => record.ticketId === result.ticketId && record.status === "pending");
    if (existing) return existing;
    const record: ReviewRecord = { id: randomUUID(), ticketId: result.ticketId, createdAt: new Date().toISOString(), status: "pending", proposed: result.decision, reasons: result.action.reasons };
    await this.append({ type: "created", record });
    return record;
  }

  async resolve(id: string, input: { status: "approved" | "rejected" | "corrected"; actor: string; team?: string; note?: string }): Promise<ReviewRecord> {
    const record = (await this.list()).find((item) => item.id === id);
    if (!record) throw new Error("review not found");
    if (record.status !== "pending") throw new Error("review already resolved");
    const resolution: NonNullable<ReviewRecord["resolution"]> = { at: new Date().toISOString(), actor: input.actor, ...(input.team ? { team: input.team } : {}), ...(input.note ? { note: input.note } : {}) };
    await this.append({ type: "resolved", id, resolution, status: input.status });
    return { ...record, status: input.status, resolution };
  }

  async list(): Promise<ReviewRecord[]> {
    let content = "";
    try { content = await readFile(this.path, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const records = new Map<string, ReviewRecord>();
    for (const line of content.split(/\r?\n/).filter(Boolean)) {
      const event = JSON.parse(line) as ReviewEvent;
      if (event.type === "created") records.set(event.record.id, event.record);
      else {
        const record = records.get(event.id);
        if (record) records.set(event.id, { ...record, status: event.status, resolution: event.resolution });
      }
    }
    return [...records.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
