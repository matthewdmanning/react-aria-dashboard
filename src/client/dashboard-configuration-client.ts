import {
  parseDashboardConfiguration,
  readableDashboardSchema,
  roleSchema,
  type DashboardConfiguration,
  type Mutation,
  type ReadableDashboard,
  type Role,
} from "../contract";
import { failureFrom } from "./request";

const endpoint = "/api/dashboard-configuration";

/**
 * Returns the categories this caller may read. Denied categories are absent
 * rather than empty, so the caller can tell "not permitted" from "none exist".
 */
export async function loadReadableDashboard(): Promise<ReadableDashboard> {
  const response = await fetch(`${endpoint}?scope=all`);
  if (!response.ok) throw await failureFrom(response);
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
  if (!response.ok) throw await failureFrom(response);
  return parseDashboardConfiguration(await response.json());
}

/** The caller's own role. Not gated — a caller may always see what it may do. */
export async function loadCallerRole(): Promise<Role> {
  const response = await fetch(`${endpoint}?scope=role`);
  if (!response.ok) throw await failureFrom(response);
  return roleSchema.parse(await response.json());
}
