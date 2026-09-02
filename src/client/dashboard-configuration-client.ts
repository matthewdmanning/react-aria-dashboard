import {
  parseDashboardConfiguration,
  readableDashboardSchema,
  type DashboardConfiguration,
  type Mutation,
  type ReadableDashboard,
} from "../contract";

const endpoint = "/api/dashboard-configuration";

/**
 * Returns the categories this caller may read. Denied categories are absent
 * rather than empty, so the caller can tell "not permitted" from "none exist".
 */
export async function loadReadableDashboard(): Promise<ReadableDashboard> {
  const response = await fetch(`${endpoint}?scope=all`);
  if (!response.ok) throw new Error(await response.text());
  return readableDashboardSchema.parse(await response.json());
}

export async function applyDashboardMutations(
  mutations: readonly Mutation[],
): Promise<DashboardConfiguration> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mutations),
  });
  if (!response.ok) throw new Error(await response.text());
  return parseDashboardConfiguration(await response.json());
}
