import type { Scenario } from "./types";

// Every JSON file in fixtures/scenarios is a template. The Rust fixture test
// validates the same files against the engine's schema.
const modules = import.meta.glob<Scenario>("../../../fixtures/scenarios/*.json", {
  eager: true,
  import: "default",
});

export const TEMPLATES: readonly Scenario[] = Object.values(modules).sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_TEMPLATE: Scenario = TEMPLATES.find((t) => t.id === "winger-receiving") ?? TEMPLATES[0];

export function templateById(id: string): Scenario | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
