import { describe, expect, it, vi } from "vitest";
import type { DirectoryValidation } from "../services/paths.js";
import { createPathInputModel } from "./path-input.js";

describe("path input model", () => {
  it("keeps invalid paths in the prompt with an inline error", async () => {
    const model = createPathInputModel({
      initialValue: "/tmp/missing",
      validate: vi.fn(async (): Promise<DirectoryValidation> => ({ ok: false, error: "Path does not exist: /tmp/missing" })),
      complete: vi.fn(),
    });

    await model.submit();

    expect(model.getState()).toMatchObject({ submitted: undefined, error: "Path does not exist: /tmp/missing" });
  });

  it("submits valid paths", async () => {
    const model = createPathInputModel({
      initialValue: "/tmp/project",
      validate: vi.fn(async (): Promise<DirectoryValidation> => ({ ok: true, path: "/tmp/project" })),
      complete: vi.fn(),
    });

    await model.submit();

    expect(model.getState()).toMatchObject({ submitted: "/tmp/project", error: undefined });
  });

  it("uses Tab completion to update the input value", async () => {
    const model = createPathInputModel({
      initialValue: "~/Pro",
      validate: vi.fn(),
      complete: vi.fn(async () => ({ completed: "~/Projects/", suggestions: ["~/Projects/"] })),
    });

    await model.completePath();

    expect(model.getState()).toMatchObject({ value: "~/Projects/", suggestions: ["~/Projects/"], error: undefined });
  });

  it("shows suggestions when Tab has multiple matches", async () => {
    const model = createPathInputModel({
      initialValue: "~/P",
      validate: vi.fn(),
      complete: vi.fn(async () => ({ suggestions: ["~/Pictures/", "~/Projects/"] })),
    });

    await model.completePath();

    expect(model.getState()).toMatchObject({ value: "~/P", suggestions: ["~/Pictures/", "~/Projects/"], error: undefined });
  });

  it("cancels on escape", () => {
    const model = createPathInputModel({ initialValue: "/tmp", validate: vi.fn(), complete: vi.fn() });

    model.cancel();

    expect(model.getState()).toMatchObject({ cancelled: true });
  });
});
