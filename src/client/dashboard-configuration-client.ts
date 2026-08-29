import {
  parseDashboardConfiguration,
  type DashboardConfiguration,
} from "../dashboard";

const endpoint = "/api/dashboard-configuration";

export async function loadDashboardConfiguration(): Promise<DashboardConfiguration> {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("Could not load dashboard configuration");
  return parseDashboardConfiguration(await response.json());
}

export async function saveDashboardConfiguration(
  configuration: DashboardConfiguration,
): Promise<void> {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(configuration),
  });
  if (!response.ok) throw new Error("Could not save dashboard configuration");
}

export async function loadSources(): Promise<Record<string, unknown>> {
  const response = await fetch("/api/sources");
  if (!response.ok) throw new Error("Could not load dashboard sources");
  return (await response.json()) as Record<string, unknown>;
}
