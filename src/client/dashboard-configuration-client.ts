import * as z from "zod/v4";

import {
  parseDashboardConfiguration,
  roleSchema,
  type DashboardConfiguration,
  type Mutation,
  type Role,
} from "../contract";

const endpoint = "/api/dashboard-configuration";

async function read(scope: string) {
  const response = await fetch(`${endpoint}?scope=${scope}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function loadDashboardConfiguration(): Promise<DashboardConfiguration> {
  const payload = await read("all");
  return parseDashboardConfiguration({ roles: [], ...payload });
}

export async function loadDashboardRoles(): Promise<Role[] | undefined> {
  const response = await fetch(`${endpoint}?scope=roles`);
  if (response.status === 403) return undefined;
  if (!response.ok) throw new Error(await response.text());
  return z.array(roleSchema).parse(await response.json());
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
