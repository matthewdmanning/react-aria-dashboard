import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { readDashboard, replaceDashboard } from "../src/server/dashboard-store";
import {
  approveDashboardConfiguration,
  proposeDashboardConfiguration,
} from "../src/server/mcp";

it("changes dashboard configuration only after approving its current revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-proposal-"));
  const path = join(directory, "dashboard.json");
  const dashboard = {
    header: { title: "Before" },
    settings: { theme: "calm" },
    dataSources: [],
    componentInstances: [],
    arrangement: [],
  };

  try {
    await replaceDashboard(path, dashboard);
    const proposal = await proposeDashboardConfiguration(path, {
      ...dashboard,
      header: { title: "After" },
    });

    expect((await readDashboard(path)).header.title).toBe("Before");
    expect(proposal.preview).toContain('"title": "After"');
    await approveDashboardConfiguration(path, proposal);
    expect((await readDashboard(path)).header.title).toBe("After");

    const staleProposal = await proposeDashboardConfiguration(path, dashboard);
    await replaceDashboard(path, {
      ...dashboard,
      header: { title: "Concurrent change" },
    });
    await expect(
      approveDashboardConfiguration(path, staleProposal),
    ).rejects.toThrow("Dashboard changed after preview");
    expect((await readDashboard(path)).header.title).toBe("Concurrent change");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
