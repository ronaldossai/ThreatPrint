import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, TEMPLATES, templateById } from "./templates";

describe("scenario templates", () => {
  it("loads every bundled fixture", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_TEMPLATE.id).toBe("winger-receiving");
  });

  it("has unique template ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("looks up templates by id", () => {
    expect(templateById("flank-overlap-2v1")?.name).toMatch(/overlap/i);
    expect(templateById("nope")).toBeUndefined();
  });

  it("carries a small-sided template's own pitch", () => {
    expect(templateById("small-sided-5v5-wide-release")?.pitch).toEqual({ lengthM: 40, widthM: 20, goalWidthM: 3.66 });
  });
});
