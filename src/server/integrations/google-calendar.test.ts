import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";

import { defaultDashboardConfiguration } from "../../dashboard";
import { replaceDashboardConfiguration } from "../dashboard-store";
import { formatGoogleCalendar } from "../../client/formatters/google-calendar";
import { pullGoogleCalendar } from "./google-calendar";

async function calendarFiles() {
  const directory = await mkdtemp(join(tmpdir(), "google-calendar-"));
  const configurationPath = join(directory, "dashboard.json");
  const dataPath = join(directory, "calendar.json");
  await replaceDashboardConfiguration(configurationPath, {
    ...defaultDashboardConfiguration,
    integrations: [
      {
        id: "work-calendar",
        type: "google-calendar",
        settings: { calendarId: "team@example.com" },
      },
    ],
  });
  return { configurationPath, dataPath };
}

describe("Google Calendar integration contract", () => {
  test("pulls the saved calendar, retains its raw response, and formats panel data separately", async () => {
    const paths = await calendarFiles();
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
      ...paths,
      tokenProvider: async () => "access-token",
      fetch: fetchCalendar,
    });

    expect(fetchCalendar).toHaveBeenCalledWith(
      "https://www.googleapis.com/calendar/v3/calendars/team%40example.com/events",
      { headers: { Authorization: "Bearer access-token" } },
    );
    expect(pulled).toEqual(source);
    expect(JSON.parse(await readFile(paths.dataPath, "utf8"))).toEqual(source);
    expect(formatGoogleCalendar(pulled)).toEqual({
      events: [
        {
          id: "event-1",
          title: "Planning",
          start: "2026-08-27T09:00:00-04:00",
          end: "2026-08-27T10:00:00-04:00",
        },
      ],
    });
  });

  test("preserves the last successful data when a pull fails", async () => {
    const paths = await calendarFiles();
    const previous = { items: [{ id: "previous" }] };
    await writeFile(paths.dataPath, JSON.stringify(previous));

    await expect(
      pullGoogleCalendar({
        ...paths,
        tokenProvider: async () => "access-token",
        fetch: async () => new Response("unavailable", { status: 503 }),
      }),
    ).rejects.toThrow("503");

    expect(JSON.parse(await readFile(paths.dataPath, "utf8"))).toEqual(
      previous,
    );
  });
});
