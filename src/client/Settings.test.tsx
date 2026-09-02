import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { defaultDashboardConfiguration } from "../contract";
import { Settings } from "./Settings";

describe("Settings contract", () => {
  test("renders only direct settings controls by default", () => {
    const html = renderToStaticMarkup(
      createElement(Settings, {
        configuration: defaultDashboardConfiguration,
        onSave: async () => undefined,
      }),
    );

    expect(html).toContain("Theme");
    expect(html).toContain("Font scale");
    expect(html).toContain("Integrations");
    expect(html).not.toContain("Agent permissions");
  });

  test("renders a read-only role bundle with all four permission levels", () => {
    const html = renderToStaticMarkup(
      createElement(Settings, {
        configuration: defaultDashboardConfiguration,
        roles: [
          {
            name: "reader",
            permissions: {
              data: "none",
              cards: "read",
              presentation: "edit",
              integrations: "write",
              roles: "none",
            },
          },
        ],
        onSave: async () => undefined,
      }),
    );

    expect(html).toContain("Agent permissions");
    expect(html).toContain("data: none");
    expect(html).toContain("cards: read");
    expect(html).toContain("presentation: edit");
    expect(html).toContain("integrations: write");
    expect(html).not.toContain("<select");
  });
});
