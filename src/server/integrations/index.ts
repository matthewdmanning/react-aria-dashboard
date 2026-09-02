import {
  compileFormatterSpec,
  type Card,
  type Integration,
} from "../../contract";
import type { DashboardService } from "../../service";
import {
  pullGoogleCalendar,
  type FetchCalendar,
  type GoogleCalendarTokenProvider,
} from "./google-calendar";

export interface PullContext {
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
}

export type IntegrationPull = (
  integration: Integration,
  query: unknown,
  context: PullContext,
) => Promise<unknown>;

/**
 * Which services this build can pull from. The only place an integration type
 * is named — callers dispatch on what an integration says it is.
 */
export const integrationPulls: Record<string, IntegrationPull> = {
  "google-calendar": (_integration, query, { tokenProvider, fetch }) =>
    pullGoogleCalendar({ query, tokenProvider, fetch }),
};

export interface QueryRefresh {
  cardId: string;
  status: "refreshed" | "unsupported" | "failed";
  message?: string;
}

/**
 * Runs every card's queries: pulls each query's integration, shapes the
 * result with the query's formatter, and applies it as the card's new state
 * through `service.apply`. Nothing else persists a pull — a pulled result is
 * transient (fetch, format, apply, discard); if a formatter changes, re-pull.
 * One query's failure does not stop the rest.
 */
export async function refreshCardQueries(
  cards: readonly Card[],
  integrations: readonly Integration[],
  context: PullContext & { service: DashboardService; credential?: string },
): Promise<QueryRefresh[]> {
  const refreshes: QueryRefresh[] = [];

  for (const card of cards) {
    for (const query of card.queries) {
      const integration = integrations.find(
        ({ id }) => id === query.integration,
      );
      if (!integration) {
        refreshes.push({
          cardId: card.id,
          status: "failed",
          message: `Unknown integration: ${query.integration}`,
        });
        continue;
      }

      const pull = integrationPulls[integration.type];
      if (!pull) {
        refreshes.push({ cardId: card.id, status: "unsupported" });
        continue;
      }

      try {
        const source = await pull(integration, query.query, context);
        const patch = compileFormatterSpec(query.formatter)(source);
        await context.service.apply(
          [{ type: "patch-card-state", cardId: card.id, patch }],
          context.credential,
        );
        refreshes.push({ cardId: card.id, status: "refreshed" });
      } catch (error) {
        refreshes.push({
          cardId: card.id,
          status: "failed",
          message: error instanceof Error ? error.message : "Pull failed",
        });
      }
    }
  }

  return refreshes;
}
