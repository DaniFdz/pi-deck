import { describe, expect, it } from "vitest";
import { dashboardActionForKey } from "./dashboard.js";

describe("dashboard actions", () => {
  it("maps n to creating a new session", () => {
    expect(dashboardActionForKey("n", "ses_1")).toEqual({ type: "new" });
  });

  it("maps enter on a session to attaching that session", () => {
    expect(dashboardActionForKey("\r", "ses_1")).toEqual({ type: "attach", sessionId: "ses_1" });
  });

  it("maps d on a session to deleting that session", () => {
    expect(dashboardActionForKey("d", { type: "session", id: "ses_1", parentId: "root" })).toEqual({ type: "delete", rowType: "session", id: "ses_1" });
  });

  it("maps g to creating a group under the selected group", () => {
    expect(dashboardActionForKey("g", { type: "group", id: "grp_work", parentId: "root" })).toEqual({ type: "new-group", parentId: "grp_work" });
  });

  it("maps m to moving the selected item", () => {
    expect(dashboardActionForKey("m", { type: "session", id: "ses_1", parentId: "root" })).toEqual({ type: "choose-move-destination", rowType: "session", id: "ses_1" });
  });

  it("maps J/K and shift arrows to reorder actions", () => {
    expect(dashboardActionForKey("J", { type: "session", id: "ses_1", parentId: "root" })).toEqual({ type: "move", parentId: "root", child: { type: "session", id: "ses_1" }, direction: 1 });
    expect(dashboardActionForKey("K", { type: "group", id: "grp_work", parentId: "root" })).toEqual({ type: "move", parentId: "root", child: { type: "group", id: "grp_work" }, direction: -1 });
    expect(dashboardActionForKey("\u001b[1;2B", { type: "session", id: "ses_1", parentId: "root" })).toEqual({ type: "move", parentId: "root", child: { type: "session", id: "ses_1" }, direction: 1 });
    expect(dashboardActionForKey("\u001b[1;2A", { type: "session", id: "ses_1", parentId: "root" })).toEqual({ type: "move", parentId: "root", child: { type: "session", id: "ses_1" }, direction: -1 });
  });

  it("does not attach when enter is pressed on a group", () => {
    expect(dashboardActionForKey("\r", undefined)).toBeUndefined();
  });
});
