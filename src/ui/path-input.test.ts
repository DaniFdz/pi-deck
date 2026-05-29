import { describe, expect, it, vi } from "vitest";
import type { DirectoryValidation } from "../services/paths.js";
import { PathPromptInput, createPathInputModel } from "./path-input.js";

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

    expect(model.getState()).toMatchObject({ value: "~/Projects/", suggestions: ["~/Projects/"], highlightedSuggestion: "~/Projects/", error: undefined });
  });

  it("applies shared-prefix completion when Tab has multiple matches", async () => {
    const model = createPathInputModel({
      initialValue: "~/Pro",
      validate: vi.fn(),
      complete: vi.fn(async () => ({ completed: "~/Project", suggestions: ["~/ProjectAlpha/", "~/ProjectBeta/"] })),
    });

    await model.completePath();

    expect(model.getState()).toMatchObject({
      value: "~/Project",
      suggestions: ["~/ProjectAlpha/", "~/ProjectBeta/"],
      highlightedSuggestion: "~/ProjectAlpha/",
      error: undefined,
    });
  });

  it("moves the cursor to the end when setting path values", () => {
    const input = new PathPromptInput();

    input.setPathValue("/tmp/project");

    expect(input.render(80)[0]).toContain("/tmp/project\u001b[7m \u001b[27m");
  });

  it("cancels on escape", () => {
    const model = createPathInputModel({ initialValue: "/tmp", validate: vi.fn(), complete: vi.fn() });

    model.cancel();

    expect(model.getState()).toMatchObject({ cancelled: true });
  });
});
