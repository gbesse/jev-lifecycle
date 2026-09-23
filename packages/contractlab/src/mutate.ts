import type { Json } from "./types.js";

export type Mutation = { id: string; description: string; state: Json };

function reverseObject(value: Json): Json {
  if (Array.isArray(value)) return value.map(reverseObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseObject(item)]));
  }
  return value;
}

function mapStrings(value: Json, update: (input: string) => string): Json {
  if (typeof value === "string") return update(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, update));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, update)]));
  return value;
}

export function generateMutations(state: Json): Mutation[] {
  const variants: Mutation[] = [
    { id: "key-order", description: "Reverse object key order without changing meaning.", state: reverseObject(state) },
    { id: "whitespace", description: "Normalize text with harmless surrounding whitespace.", state: mapStrings(state, (value) => `  ${value.trim()}  `) },
    { id: "distractor", description: "Add clearly irrelevant context to expose distractor sensitivity.", state: typeof state === "object" && state !== null && !Array.isArray(state) ? { ...state, __contractlab_irrelevant: "The office plants were watered on Tuesday." } : { value: state, __contractlab_irrelevant: "The office plants were watered on Tuesday." } },
  ];
  return variants;
}
