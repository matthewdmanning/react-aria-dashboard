import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { defaultDashboardConfiguration } from "../contract";
import { createFilePersistence } from "../service";

async function writeIfAbsent(path: string, contents: string): Promise<void> {
  if (
    await access(path)
      .then(() => true)
      .catch(() => false)
  ) {
    console.error(`Already initialized: ${path}`);
    process.exit(1);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

async function main() {
  const workspace = resolve(process.env.DASHBOARD_WORKSPACE ?? ".");
  const dashboardPath =
    process.env.DASHBOARD_DATA_PATH ??
    join(workspace, ".dashboard", "dashboard.json");
  const authStorePath =
    process.env.DASHBOARD_AUTH_STORE_PATH ??
    join(workspace, ".dashboard", "accounts.json");
  const credentialsPath =
    process.env.DASHBOARD_INTEGRATION_CREDENTIALS_PATH ??
    join(workspace, ".dashboard", "integration-credentials.json");

  if (
    await access(dashboardPath)
      .then(() => true)
      .catch(() => false)
  ) {
    console.error(`Already initialized: ${dashboardPath}`);
    process.exit(1);
  }
  await createFilePersistence(dashboardPath).write(
    defaultDashboardConfiguration,
  );
  console.log(`Initialized dashboard: ${dashboardPath}`);

  await writeIfAbsent(authStorePath, "[]\n");
  console.log(`Initialized auth store: ${authStorePath}`);

  await writeIfAbsent(credentialsPath, "{}\n");
  console.log(`Initialized credential store: ${credentialsPath}`);
}

main();
