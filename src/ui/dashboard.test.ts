import { describe, expect, it } from "vitest";
import { dashboardActionForKey } from "./dashboard.js";

describe("dashboard actions", () => {
  it("maps n to creating a new session", () => {
    expect(dashboardActionForKey("n", "ses_1")).toEqual({ type: "new" });
  });

  it("maps enter on a session to attaching that session", () => {
    expect(dashboardActionForKey("\r", "ses_1")).toEqual({ type: "attach", sessionId: "ses_1" });
  });

  it("does not attach when enter is pressed on a group", () => {
    expect(dashboardActionForKey("\r", undefined)).toBeUndefined();
  });
});
