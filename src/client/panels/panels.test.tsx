import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { formatIdentity } from "../formatters/identity";
import {
  calendarPanel,
  cardsPanel,
  chartPanel,
  messagePanel,
  tablePanel,
} from "./index";

describe("included panel contract", () => {
  test("displays likely formatted message, table, cards, calendar, and chart data", () => {
    const examples = [
      [messagePanel, { message: "Ready" }, "Ready"],
      [
        tablePanel,
        { columns: [{ key: "task", label: "Task" }], rows: [{ task: "Review" }] },
        "<th scope=\"col\">Task</th>",
      ],
      [cardsPanel, { items: [{ id: "1", title: "Plan", body: "Today" }] }, "<article>"],
      [
        calendarPanel,
        { events: [{ id: "1", title: "Stand-up", start: "2026-08-27T09:00:00Z" }] },
        "<time dateTime=\"2026-08-27T09:00:00Z\">",
      ],
      [
        chartPanel,
        { title: "Progress", summary: "Two completed", series: [{ label: "Done", value: 2 }] },
        "aria-label=\"Two completed\"",
      ],
    ] as const;

    for (const [panel, source, expected] of examples) {
      const html = renderToStaticMarkup(
        createElement(panel.Component as ComponentType<{ data: unknown }>, {
          data: formatIdentity(source),
        }),
      );
      expect(html).toContain(expected);
    }
  });
});
