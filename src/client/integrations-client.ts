import { failureFrom } from "./request";

export interface IntegrationRefresh {
  id: string;
  status: "refreshed" | "unsupported" | "failed";
  message?: string;
}

/** Pulls every integration. The view names no service; the server dispatches. */
export async function refreshIntegrations(): Promise<IntegrationRefresh[]> {
  const response = await fetch("/api/integrations/refresh", { method: "POST" });
  if (!response.ok) {
    throw await failureFrom(response, "Could not refresh integrations");
  }
  return (await response.json()) as IntegrationRefresh[];
}
