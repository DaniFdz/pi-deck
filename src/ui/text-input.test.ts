import { describe, expect, it, vi } from "vitest";
import { createRequiredTextInputModel } from "./text-input.js";

describe("required text input model", () => {
  it("keeps empty values in the prompt with an inline error", () => {
    const model = createRequiredTextInputModel({ initialValue: "", errorMessage: "Session name is required" });

    model.submit("");

    expect(model.getState()).toMatchObject({ submitted: undefined, error: "Session name is required" });
  });

  it("submits trimmed non-empty values", async () => {
    const model = createRequiredTextInputModel({ initialValue: "", errorMessage: "Session name is required" });

    await model.submit("  docs update  ");

    expect(model.getState()).toMatchObject({ submitted: "docs update", error: undefined });
  });

  it("runs custom validation before submitting", async () => {
    const model = createRequiredTextInputModel({
      initialValue: "",
      errorMessage: "Branch name is required",
      validate: vi.fn(async () => "Invalid branch name"),
    });

    await model.submit("bad branch");

    expect(model.getState()).toMatchObject({ submitted: undefined, error: "Invalid branch name" });
  });
});
