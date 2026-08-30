import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  parseDashboardConfiguration,
  type DashboardConfiguration,
} from "../dashboard";

export async function readDashboardConfiguration(
  path: string,
): Promise<DashboardConfiguration> {
  return parseDashboardConfiguration(JSON.parse(await readFile(path, "utf8")));
}

export async function replaceDashboardConfiguration(
  path: string,
  candidate: unknown,
): Promise<void> {
  const serialized = JSON.stringify(candidate);
  if (serialized === undefined) {
    throw new Error("Invalid dashboard configuration: value must be JSON");
  }

  const configuration = parseDashboardConfiguration(JSON.parse(serialized));
  const temporaryPath = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });

  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(configuration, null, 2)}\n`,
    );
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
