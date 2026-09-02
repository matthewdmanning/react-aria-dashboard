import { failureFrom } from "./request";

export interface IntegrationRefresh {
  cardId: string;
  status: "refreshed" | "unsupported" | "failed";
  message?: string;
}

/** Runs every card's queries. The view names no service; the server dispatches. */
export async function refreshIntegrations(): Promise<IntegrationRefresh[]> {
  const response = await fetch("/api/integrations/refresh", { method: "POST" });
  if (!response.ok) {
    throw await failureFrom(response, "Could not refresh integrations");
  }
  return (await response.json()) as IntegrationRefresh[];
}
