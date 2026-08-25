import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  parseDashboardConfiguration,
  type DashboardConfiguration,
} from "../dashboard/index";

export async function readDashboard(
  path: string,
): Promise<DashboardConfiguration> {
  return parseDashboardConfiguration(JSON.parse(await readFile(path, "utf8")));
}

export async function replaceDashboard(
  path: string,
  candidate: unknown,
): Promise<void> {
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(candidate);
  } catch {
    throw new Error("Invalid dashboard configuration: value must be JSON");
  }
  if (serialized === undefined) {
    throw new Error("Invalid dashboard configuration: value must be JSON");
  }
  const configuration: DashboardConfiguration = parseDashboardConfiguration(
    JSON.parse(serialized),
  );

  await mkdir(dirname(path), { recursive: true });
  // ponytail: serialized writes use one temp file; add locking if concurrent writers arrive.
  const temporaryPath = `${path}.tmp`;

  try {
    await writeFile(temporaryPath, `${JSON.stringify(configuration, null, 2)}\n`);
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function updateDashboardDataSource(
  path: string,
  id: string,
  data: unknown,
): Promise<void> {
  const configuration = await readDashboard(path);
  if (!configuration.dataSources.some((source) => source.id === id)) {
    throw new Error(`Data source not found: ${id}`);
  }
  await replaceDashboard(path, {
    ...configuration,
    dataSources: configuration.dataSources.map((source) =>
      source.id === id ? { ...source, data } : source,
    ),
  });
}
