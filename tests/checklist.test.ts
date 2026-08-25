import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import {
  checklistComponentDefinition,
  completeChecklistItem,
  renderComponent,
} from "../src/dashboard/index";
import {
  readDashboard,
  replaceDashboard,
  updateDashboardDataSource,
} from "../src/server/dashboard-store";

it("renders checklist state and persists edits to its canonical data source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dashboard-checklist-"));
  const path = join(directory, "dashboard.json");
  const data = {
    items: [{ id: "one", label: "First", completed: false }],
  };
  const dashboard = {
    header: { title: "Today" },
    settings: { theme: "calm" },
    dataSources: [{ id: "tasks", data }],
    componentInstances: [
      { id: "tasks", definition: "checklist", dataSource: "tasks" },
    ],
    arrangement: ["tasks"],
  };

  try {
    expect(
      renderToStaticMarkup(renderComponent(checklistComponentDefinition, data)),
    ).toContain('<input type="checkbox"');

    await replaceDashboard(path, dashboard);
    await updateDashboardDataSource(
      path,
      "tasks",
      completeChecklistItem(data, "one", true),
    );
    expect((await readDashboard(path)).dataSources[0].data).toEqual({
      items: [{ id: "one", label: "First", completed: true }],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
