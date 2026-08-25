import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { readDashboard, replaceDashboard } from "../src/server/dashboard-store";
import { pullPublicGoogleCalendar } from "../src/server/integrations/google-calendar";

it("retains the last successful public calendar pull when a later pull fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-calendar-"));
  const path = join(directory, "dashboard.json");
  const dashboard = {
    header: { title: "Today" },
    settings: { theme: "calm" },
    dataSources: [{ id: "calendar", data: { events: [] } }],
    componentInstances: [
      { id: "calendar", definition: "calendar", dataSource: "calendar" },
    ],
    arrangement: ["calendar"],
  };

  try {
    await replaceDashboard(path, dashboard);
    await pullPublicGoogleCalendar({
      dashboardPath: path,
      dataSourceId: "calendar",
      calendarId: "public@example.com",
      accessKey: "test-key",
      fetchCalendar: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "event-1",
              summary: "Review",
              start: { dateTime: "2026-08-24T14:00:00Z" },
              end: { dateTime: "2026-08-24T15:00:00Z" },
            },
          ],
        }),
      }),
    });
    expect((await readDashboard(path)).dataSources[0].data).toEqual({
      events: [
        {
          id: "event-1",
          title: "Review",
          start: "2026-08-24T14:00:00Z",
          end: "2026-08-24T15:00:00Z",
        },
      ],
    });

    await expect(
      pullPublicGoogleCalendar({
        dashboardPath: path,
        dataSourceId: "calendar",
        calendarId: "public@example.com",
        accessKey: "test-key",
        fetchCalendar: async () => ({
          ok: false,
          status: 503,
          json: async () => ({}),
        }),
      }),
    ).rejects.toThrow("Google Calendar pull failed: 503");
    expect((await readDashboard(path)).dataSources[0].data).toEqual({
      events: [
        {
          id: "event-1",
          title: "Review",
          start: "2026-08-24T14:00:00Z",
          end: "2026-08-24T15:00:00Z",
        },
      ],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
