import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import * as z from "zod/v4";

import {
  compileFormatterSpec,
  parseDashboardConfiguration,
  renderDashboard,
  type DashboardConfiguration,
  type FormatterSpec,
  type CardTemplate,
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
    cards: "none",
  },
  cards: [
    { id: "first", title: "First", template: "message" },
    { id: "second", title: "Second", template: "message" },
  ],
  wiring: [
    { cardId: "first", source: "first-source", formatter: "message" },
    { cardId: "second", source: "second-source", formatter: "message" },
  ],
  arrangement: ["second", "first"],
  formatterSpecs: {},
};

const message: CardTemplate<{ message: string }> = {
  schema: z.object({ message: z.string() }),
  Component: ({ data }) => createElement("p", null, data.message),
};

describe("dashboard configuration contract", () => {
  test("loads every persistent dashboard concern", () => {
    expect(parseDashboardConfiguration(configuration)).toEqual(configuration);
  });

  test("renders cards in arrangement order through separate formatter wiring", () => {
    const html = renderToStaticMarkup(
      renderDashboard(configuration, {
        cardTemplates: { message },
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

  test("rejects wiring that references an unknown formatter", () => {
    expect(() =>
      parseDashboardConfiguration({
        ...configuration,
        wiring: [
          { cardId: "first", source: "first-source", formatter: "made-up" },
          { cardId: "second", source: "second-source", formatter: "message" },
        ],
      }),
    ).toThrow("unknown formatter");
  });
});

describe("compileFormatterSpec", () => {
  test("maps object fields with a fallback chain, default, and coercion", () => {
    const spec: FormatterSpec = {
      shape: "object",
      fields: {
        title: { from: ["summary", "title"], default: "Untitled" },
        temperature: { from: ["temp"], coerce: "string" },
        note: { from: ["missing"] },
      },
    };
    expect(
      compileFormatterSpec(spec)({ summary: "Standup", temp: 72 }),
    ).toEqual({
      title: "Standup",
      temperature: "72",
    });
    expect(compileFormatterSpec(spec)({ temp: 0 })).toEqual({
      title: "Untitled",
      temperature: "0",
    });
  });

  test("maps an array with $index and defaults to an empty array", () => {
    const spec: FormatterSpec = {
      shape: "array",
      from: ["items"],
      into: "events",
      fields: {
        id: { from: ["id", "$index"], coerce: "string" },
        title: { from: ["summary"], default: "Untitled" },
      },
    };
    expect(
      compileFormatterSpec(spec)({
        items: [{ summary: "Standup" }, { id: "x" }],
      }),
    ).toEqual({
      events: [
        { id: "0", title: "Standup" },
        { id: "x", title: "Untitled" },
      ],
    });
    expect(compileFormatterSpec(spec)({ items: "not an array" })).toEqual({
      events: [],
    });
  });

  test("matches the hand-written Google Calendar formatter for equivalent input", async () => {
    const { formatGoogleCalendar } = await import(
      "../client/formatters/google-calendar"
    );
    const spec: FormatterSpec = {
      shape: "array",
      from: ["items"],
      into: "events",
      fields: {
        id: {
          from: ["id"],
          default: "calendar-event-$index",
          coerce: "string",
        },
        title: {
          from: ["summary"],
          default: "Untitled event",
          coerce: "string",
        },
        start: {
          from: ["start.dateTime", "start.date"],
          default: "",
          coerce: "string",
        },
        end: { from: ["end.dateTime", "end.date"], coerce: "string" },
      },
    };
    const fixture = {
      items: [
        {
          id: "abc",
          summary: "Standup",
          start: { dateTime: "2026-08-27T09:00:00Z" },
          end: { dateTime: "2026-08-27T09:15:00Z" },
        },
        { start: { date: "2026-08-28" } },
      ],
    };
    expect(compileFormatterSpec(spec)(fixture)).toEqual(
      formatGoogleCalendar(fixture),
    );
  });
});
