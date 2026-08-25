import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  messageComponentDefinition,
  renderComponent,
} from "../src/dashboard/index";

describe("component definition", () => {
  it("renders conforming unknown data and rejects invalid data", () => {
    expect(
      renderToStaticMarkup(
        renderComponent(messageComponentDefinition, { message: "Ready" }),
      ),
    ).toBe("<p>Ready</p>");

    expect(() =>
      renderComponent(messageComponentDefinition, { message: 42 }),
    ).toThrow("Invalid component data");
  });
});
