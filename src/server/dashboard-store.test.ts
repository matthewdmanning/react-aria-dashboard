import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import type { DashboardConfiguration } from "../dashboard";
import {
  readDashboardConfiguration,
  replaceDashboardConfiguration,
} from "./dashboard-store";

const configuration: DashboardConfiguration = {
  version: 1,
  integrations: [],
  theme: "calm",
  fontScale: 1,
  agentPermissions: { configuration: "read", data: "none", cards: "none" },
  cards: [{ id: "welcome", title: "Welcome", template: "message" }],
  wiring: [{ cardId: "welcome", source: "welcome", formatter: "message" }],
  arrangement: ["welcome"],
  formatterSpecs: {},
};

describe("dashboard configuration persistence contract", () => {
  test("atomically replaces and reads dashboard configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dashboard-store-"));
    const path = join(directory, "dashboard.json");

    await replaceDashboardConfiguration(path, configuration);

    expect(await readDashboardConfiguration(path)).toEqual(configuration);
    expect(await readFile(path, "utf8")).toBe(
      `${JSON.stringify(configuration, null, 2)}\n`,
    );
  });
});
