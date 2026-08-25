import { describe, expect, it } from "vitest";

import {
  inspectComponentDefinitions,
  previewComponent,
} from "../src/server/mcp";

describe("dashboard MCP", () => {
  it("inspects definitions and previews only conforming data", () => {
    expect(inspectComponentDefinitions().map(({ name }) => name)).toEqual([
      "message",
      "table",
      "cards",
      "checklist",
      "calendar",
      "chart",
    ]);
    expect(previewComponent("message", { message: "Ready" })).toBe(
      "<p>Ready</p>",
    );
    expect(() => previewComponent("message", { message: 42 })).toThrow(
      "Invalid component data",
    );
  });
});
