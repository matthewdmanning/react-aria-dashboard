import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  readPanelPackage,
  validatePanelPackageManifest,
} from "./panel-packages";

const manifest = {
  id: "weather-panel",
  title: "Weather",
  schema: "schema.json",
  component: "panel.tsx",
  sources: ["weather"],
};

describe("panel package contract", () => {
  test("validates an independent package and rejects executable access", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "panel-package-"));
    const root = join(workspace, "panels", "weather-panel");
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "panel.json"), JSON.stringify(manifest));
    await writeFile(
      join(root, "schema.json"),
      JSON.stringify({
        type: "object",
        properties: { temperature: { type: "number" } },
        required: ["temperature"],
      }),
    );
    await writeFile(
      join(root, "panel.tsx"),
      "export function Panel({ data }) { return data.temperature; }",
    );

    await expect(
      readPanelPackage(workspace, "weather-panel"),
    ).resolves.toMatchObject({
      manifest,
      root,
    });
    expect(() => validatePanelPackageManifest(manifest)).not.toThrow();

    await writeFile(
      join(root, "panel.tsx"),
      "import fs from 'node:fs'; export function Panel() { return null; }",
    );
    await expect(readPanelPackage(workspace, "weather-panel")).rejects.toThrow(
      "forbidden",
    );
  });

  test("rejects traversal in package references", () => {
    expect(() =>
      validatePanelPackageManifest({
        ...manifest,
        component: "../panel.tsx",
      }),
    ).toThrow();
  });
});
