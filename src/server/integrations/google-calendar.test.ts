import { describe, expect, test, vi } from "vitest";

import { pullGoogleCalendar } from "./google-calendar";

describe("Google Calendar integration contract", () => {
  test("pulls the calendar named by the query, unmodified", async () => {
    const source = {
      kind: "calendar#events",
      nextSyncToken: "next-token",
      items: [
        {
          id: "event-1",
          summary: "Planning",
          start: { dateTime: "2026-08-27T09:00:00-04:00" },
          end: { dateTime: "2026-08-27T10:00:00-04:00" },
          organizer: { email: "owner@example.com" },
        },
      ],
    };
    const fetchCalendar = vi.fn(async () => Response.json(source));

    const pulled = await pullGoogleCalendar({
      query: { calendarId: "team@example.com" },
      tokenProvider: async () => "access-token",
      fetch: fetchCalendar,
    });

    expect(fetchCalendar).toHaveBeenCalledWith(
      "https://www.googleapis.com/calendar/v3/calendars/team%40example.com/events",
      { headers: { Authorization: "Bearer access-token" } },
    );
    expect(pulled).toEqual(source);
  });

  test("refuses a query with no calendarId", async () => {
    await expect(
      pullGoogleCalendar({
        query: {},
        tokenProvider: async () => "access-token",
      }),
    ).rejects.toThrow("Query is missing a calendarId");
  });

  test("surfaces a failed fetch", async () => {
    await expect(
      pullGoogleCalendar({
        query: { calendarId: "team" },
        tokenProvider: async () => "access-token",
        fetch: async () => new Response("unavailable", { status: 503 }),
      }),
    ).rejects.toThrow("503");
  });
});
