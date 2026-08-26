import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { defaultDashboardConfiguration } from "../dashboard";
import { handleDashboardConfigurationRequest } from "./index";

describe("Settings configuration API contract", () => {
  test("saves and reloads configuration through the HTTP interface", async () => {
    const directory = await mkdtemp(join(tmpdir(), "settings-api-"));
    const path = join(directory, "dashboard.json");
    const changed = { ...defaultDashboardConfiguration, theme: "contrast" };

    const saved = await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration", {
        method: "PUT",
        body: JSON.stringify(changed),
      }),
      path,
    );
    const loaded = await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration"),
      path,
    );

    expect(saved.status).toBe(204);
    await expect(loaded.json()).resolves.toEqual(changed);
  });
});
