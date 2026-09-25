import type { RouteDefinition } from "./types.js";

export type RouteNode = { id: string; description: string; route?: RouteDefinition; children?: RouteNode[] };

function summarize(items: RouteNode[]): string {
  return items.map((item) => item.description).join("; ").slice(0, 1_500);
}

function chunk(items: RouteNode[], maximum: number, prefix: string): RouteNode[] {
  if (items.length <= maximum) return items;
  const size = Math.ceil(items.length / maximum);
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => {
    const children = chunk(items.slice(index * size, (index + 1) * size), maximum, `${prefix}_${index + 1}`);
    return { id: `__${prefix}_${index + 1}`, description: summarize(children), children };
  });
}

export function buildHierarchy(routes: RouteDefinition[], maximum: number): RouteNode[] {
  if (!Number.isInteger(maximum) || maximum < 2 || maximum > 50) throw new Error("maxChoices must be an integer between 2 and 50");
  const groups = new Map<string, RouteNode[]>();
  for (const route of routes) {
    const key = route.group?.trim() || "routes";
    groups.set(key, [...(groups.get(key) ?? []), { id: route.id, description: route.description, route }]);
  }
  let level = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([group, children], groupIndex) => {
    const compact = chunk(children, maximum, `route_${groupIndex + 1}`);
    return groups.size === 1 && compact.length <= maximum
      ? compact
      : [{ id: `__group_${groupIndex + 1}`, description: `${group}: ${summarize(children)}`.slice(0, 1_500), children: compact }];
  }).flat();
  let depth = 0;
  while (level.length > maximum) {
    level = chunk(level, maximum, `level_${depth}`);
    depth += 1;
  }
  return level;
}
