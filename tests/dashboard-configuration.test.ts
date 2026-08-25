import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { renderDashboard } from "../src/dashboard/index";
import {
  readDashboard,
  replaceDashboard,
} from "../src/server/dashboard-store";

it("persists and renders a valid dashboard while preserving it after invalid replacement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-"));
  const path = join(directory, "dashboard.json");
  const dashboard = {
    header: { title: "Today" },
    settings: { theme: "calm" },
    dataSources: [{ id: "welcome", data: { message: "Ready" } }],
    componentInstances: [
      { id: "greeting", definition: "message", dataSource: "welcome" },
    ],
    arrangement: ["greeting"],
  };

  try {
    await replaceDashboard(path, dashboard);
    expect(
      renderToStaticMarkup(
        renderDashboard(await readDashboard(path), [
          { id: "calm", tokens: {}, semanticRoles: {} },
        ]),
      ),
    ).toBe(
      '<main data-theme="calm"><header><h1>Today</h1></header><section><p>Ready</p></section></main>',
    );

    await expect(
      replaceDashboard(path, { ...dashboard, arrangement: ["missing"] }),
    ).rejects.toThrow("Invalid dashboard configuration");
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(dashboard);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
