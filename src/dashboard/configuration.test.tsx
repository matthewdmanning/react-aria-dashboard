import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  parseDashboardConfiguration,
  renderDashboard,
  type DashboardConfiguration,
  type PanelDefinition,
} from "./index";

const configuration: DashboardConfiguration = {
  version: 1,
  integrations: [
    {
      id: "calendar",
      type: "google-calendar",
      settings: { calendarId: "team" },
    },
  ],
  theme: "calm",
  fontScale: 1.1,
  agentPermissions: {
    configuration: "write",
    data: "write",
    panels: "none",
  },
  panels: [
    { id: "first", title: "First", definition: "message" },
    { id: "second", title: "Second", definition: "message" },
  ],
  wiring: [
    { panelId: "first", source: "first-source", formatter: "message" },
    { panelId: "second", source: "second-source", formatter: "message" },
  ],
  arrangement: ["second", "first"],
};

const message: PanelDefinition<{ message: string }> = {
  schema: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
  },
  Component: ({ data }) => createElement("p", null, data.message),
};

describe("dashboard configuration contract", () => {
  test("loads every persistent dashboard concern", () => {
    expect(parseDashboardConfiguration(configuration)).toEqual(configuration);
  });

  test("renders panels in arrangement order through separate formatter wiring", () => {
    const html = renderToStaticMarkup(
      renderDashboard(configuration, {
        panelDefinitions: { message },
        sources: {
          "first-source": { text: "First message" },
          "second-source": { text: "Second message" },
        },
        formatters: {
          message: (source) => ({ message: (source as { text: string }).text }),
        },
      }),
    );

    expect(html).toContain(
      "<section><h2>Second</h2><p>Second message</p></section><section><h2>First</h2><p>First message</p></section>",
    );
  });
});
