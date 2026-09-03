import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { formatIdentity } from "../formatters/identity";
import {
  calendarCard,
  listCard,
  chartCard,
  messageCard,
  tableCard,
} from "./index";
import { CardView } from "./CardView";

describe("included card contract", () => {
  test("displays likely formatted message, table, list, calendar, and chart data", () => {
    const examples = [
      [messageCard, { message: "Ready" }, "Ready"],
      [
        tableCard,
        {
          columns: [{ key: "task", label: "Task" }],
          rows: [{ task: "Review" }],
        },
        '<th scope="col">Task</th>',
      ],
      [
        listCard,
        { items: [{ id: "1", title: "Plan", body: "Today" }] },
        "<article>",
      ],
      [
        calendarCard,
        {
          events: [
            { id: "1", title: "Stand-up", start: "2026-08-27T09:00:00Z" },
          ],
        },
        '<time dateTime="2026-08-27T09:00:00Z">',
      ],
      [
        chartCard,
        {
          title: "Progress",
          summary: "Two completed",
          series: [{ label: "Done", value: 2 }],
        },
        'aria-label="Two completed"',
      ],
    ] as const;

    for (const [card, source, expected] of examples) {
      const html = renderToStaticMarkup(
        createElement(card.Component as ComponentType<{ data: unknown }>, {
          data: formatIdentity(source),
        }),
      );
      expect(html).toContain(expected);
    }
  });
});

describe("CardView", () => {
  test("renders state through the component its template names", () => {
    const html = renderToStaticMarkup(
      createElement(CardView, {
        template: "message",
        state: { message: "Ready" },
      }),
    );

    expect(html).toContain("Ready");
  });

  test("says so in place when state does not fit its card template", () => {
    const html = renderToStaticMarkup(
      createElement(CardView, { template: "message", state: { wrong: 1 } }),
    );

    expect(html).toContain("does not fit");
  });
});
