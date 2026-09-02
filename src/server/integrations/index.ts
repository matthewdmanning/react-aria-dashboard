import { join } from "node:path";

import type { Integration } from "../../contract";
import {
  pullGoogleCalendar,
  type FetchCalendar,
  type GoogleCalendarTokenProvider,
} from "./google-calendar";

export interface PullContext {
  // ponytail: a pull writes its own file, which is a second write path past the
  // service. #67 replaces it — a pulled result becomes card state through a
  // patch-card-state mutation, and nothing else persists it.
  /** Where an integration's pulled data is written, one file per integration. */
  dataDirectory: string;
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
}

export type IntegrationPull = (
  integration: Integration,
  context: PullContext,
) => Promise<unknown>;

/**
 * Which services this build can pull from. The only place an integration type
 * is named — callers dispatch on what an integration says it is.
 */
export const integrationPulls: Record<string, IntegrationPull> = {
  "google-calendar": (integration, { dataDirectory, tokenProvider, fetch }) =>
    pullGoogleCalendar({
      integrations: [integration],
      integrationId: integration.id,
      dataPath: join(dataDirectory, `${integration.id}.json`),
      tokenProvider,
      fetch,
    }),
};

export interface IntegrationRefresh {
  id: string;
  status: "refreshed" | "unsupported" | "failed";
  message?: string;
}

/**
 * Pulls every integration, reporting per integration. One failure does not stop
 * the rest — a manual refresh should do as much as it can.
 */
export async function refreshIntegrations(
  integrations: readonly Integration[],
  context: PullContext,
): Promise<IntegrationRefresh[]> {
  const refreshes: IntegrationRefresh[] = [];

  for (const integration of integrations) {
    const pull = integrationPulls[integration.type];
    if (!pull) {
      refreshes.push({ id: integration.id, status: "unsupported" });
      continue;
    }
    try {
      await pull(integration, context);
      refreshes.push({ id: integration.id, status: "refreshed" });
    } catch (error) {
      refreshes.push({
        id: integration.id,
        status: "failed",
        message: error instanceof Error ? error.message : "Pull failed",
      });
    }
  }

  return refreshes;
}
