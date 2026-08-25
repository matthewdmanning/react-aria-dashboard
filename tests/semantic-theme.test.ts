import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { renderDashboard } from "../src/dashboard/index";

it("applies selected theme and semantic-role treatments without changing data", () => {
  const html = renderToStaticMarkup(
    renderDashboard(
      {
        header: { title: "Today" },
        settings: { theme: "calm" },
        dataSources: [{ id: "welcome", data: { message: "Ready" } }],
        componentInstances: [
          {
            id: "greeting",
            definition: "message",
            dataSource: "welcome",
            semanticRoles: { message: "priority" },
          },
        ],
        arrangement: ["greeting"],
      },
      [
        {
          id: "calm",
          tokens: { "--dashboard-background": "white" },
          semanticRoles: {
            priority: {
              "--semantic-color": "red",
              "--semantic-font-weight": 700,
            },
          },
        },
      ],
    ),
  );

  expect(html).toBe(
    '<main data-theme="calm" style="--dashboard-background:white"><header><h1>Today</h1></header><section><p data-semantic-role="priority" style="--semantic-color:red;--semantic-font-weight:700">Ready</p></section></main>',
  );
});
