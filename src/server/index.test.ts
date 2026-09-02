import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";

import { defaultDashboardConfiguration } from "../contract";
import {
  createService,
  type DashboardPersistence,
  type DashboardService,
} from "../service";
import {
  handleDashboardConfigurationRequest,
  handleIntegrationRefreshRequest,
} from "./index";

function createMemoryPersistence(
  initial = defaultDashboardConfiguration,
): DashboardPersistence {
  let configuration = structuredClone(initial);
  return {
    read: async () => structuredClone(configuration),
    write: async (next) => {
      configuration = structuredClone(next);
    },
  };
}

function createTestService(
  initial = defaultDashboardConfiguration,
): DashboardService {
  return createService({ persistence: createMemoryPersistence(initial) });
}

describe("dashboard service HTTP transport", () => {
  test("reads the requested scope through the service", async () => {
    const response = await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration?scope=all"),
      createTestService(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cards: defaultDashboardConfiguration.cards,
      dashboard: defaultDashboardConfiguration.dashboard,
      themes: defaultDashboardConfiguration.themes,
      fontScale: defaultDashboardConfiguration.fontScale,
      integrations: defaultDashboardConfiguration.integrations,
    });
  });

  test("applies mutation lists through the service", async () => {
    const service = createTestService();
    const response = await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration", {
        method: "POST",
        body: JSON.stringify([
          {
            type: "set-font-scale",
            permission: "presentation",
            fontScale: 1.25,
          },
        ]),
      }),
      service,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ fontScale: 1.25 });
  });

  test("returns service permission errors without a second authorization check", async () => {
    const response = await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration?scope=roles"),
      createTestService(),
    );

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain("roles: read");
  });
});

describe("integration refresh endpoint", () => {
  test("pulls every integration read through the service", async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "integration-api-"));
    const source = { items: [{ id: "event-1", summary: "Planning" }] };
    const pull = vi.fn(async () => Response.json(source));
    const service = createTestService({
      ...defaultDashboardConfiguration,
      integrations: [
        {
          id: "team-calendar",
          type: "google-calendar",
          settings: { calendarId: "team" },
        },
        { id: "unknown", type: "not-built-in", settings: {} },
      ],
    });

    const response = await handleIntegrationRefreshRequest(
      new Request("http://dashboard/api/integrations/refresh", {
        method: "POST",
      }),
      dataDirectory,
      { service, tokenProvider: async () => "access-token", fetch: pull },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { id: "team-calendar", status: "refreshed" },
      { id: "unknown", status: "unsupported" },
    ]);
    await expect(
      readFile(join(dataDirectory, "team-calendar.json"), "utf8"),
    ).resolves.toContain('"summary": "Planning"');
  });

  test("reports one integration's failure without stopping the rest", async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "integration-api-"));
    const service = createTestService({
      ...defaultDashboardConfiguration,
      integrations: [
        {
          id: "team-calendar",
          type: "google-calendar",
          settings: { calendarId: "team" },
        },
      ],
    });

    const response = await handleIntegrationRefreshRequest(
      new Request("http://dashboard/api/integrations/refresh", {
        method: "POST",
      }),
      dataDirectory,
      {
        service,
        tokenProvider: async () => {
          throw new Error("Credentials are not configured");
        },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: "team-calendar",
        status: "failed",
        message: "Credentials are not configured",
      },
    ]);
  });
});
