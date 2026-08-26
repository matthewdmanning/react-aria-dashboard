import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { defaultDashboardConfiguration } from "../dashboard";
import { replaceDashboardConfiguration } from "./dashboard-store";
import { createDashboardOperations } from "./mcp";

describe("dashboard MCP operations contract", () => {
  test("performs permission-governed configuration and artifact work", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "dashboard-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    const configuration = {
      ...defaultDashboardConfiguration,
      agentPermissions: {
        configuration: "write" as const,
        artifacts: "write" as const,
        data: "none" as const,
      },
    };
    await replaceDashboardConfiguration(configurationPath, configuration);
    const operations = createDashboardOperations(workspace);

    await expect(operations.inspectConfiguration()).resolves.toEqual(configuration);
    await operations.replaceConfiguration({ ...configuration, theme: "contrast" });
    await operations.writeArtifact("panels/weather.tsx", "export const weather = true;\n");

    await expect(operations.readArtifact("panels/weather.tsx")).resolves.toBe(
      "export const weather = true;\n",
    );
    await expect(operations.readArtifact("data/private.json")).rejects.toThrow(
      "permission",
    );
    await expect(operations.writeArtifact("../outside.txt", "no")).rejects.toThrow(
      "workspace",
    );
    expect(JSON.parse(await readFile(configurationPath, "utf8"))).toMatchObject({
      theme: "contrast",
      agentPermissions: configuration.agentPermissions,
    });
  });
});
