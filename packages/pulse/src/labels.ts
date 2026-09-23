import type { DecisionEvent, LabelEvent } from "./types.js";

export function attachLabels(events: DecisionEvent[], labels: LabelEvent[]): DecisionEvent[] {
  const byId = new Map(labels.map((label) => [label.id, label.label]));
  return events.map((event) => {
    const label = byId.get(event.id);
    return label === undefined ? { ...event } : { ...event, label };
  });
}
