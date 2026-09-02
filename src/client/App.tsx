import { useEffect, useState } from "react";

import type { ReadableDashboard, Role } from "../contract";
import {
  applyDashboardMutations,
  loadCallerRole,
  loadReadableDashboard,
} from "./dashboard-configuration-client";
import { refreshIntegrations } from "./integrations-client";
import { CardView } from "./cards/CardView";
import { Settings } from "./Settings";

function renderDashboard({ dashboard, cards, fontScale }: ReadableDashboard) {
  if (!dashboard || !cards) {
    return <p>You do not have permission to view this dashboard.</p>;
  }

  const byId = new Map(cards.map((card) => [card.id, card]));

  return (
    <main
      data-theme={dashboard.theme}
      style={{ fontSize: `${fontScale ?? 1}rem` }}
    >
      {dashboard.cards.map((cardId) => {
        const card = byId.get(cardId);
        if (!card) return null;
        return (
          <section key={card.id}>
            <h2>{card.title}</h2>
            <CardView template={card.template} state={card.state} />
          </section>
        );
      })}
    </main>
  );
}

export function App() {
  const [dashboard, setDashboard] = useState<ReadableDashboard>();
  const [callerRole, setCallerRole] = useState<Role>();
  const [error, setError] = useState<string>();
  const [refreshError, setRefreshError] = useState<string>();

  useEffect(() => {
    void loadReadableDashboard()
      .then(setDashboard)
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Could not load dashboard",
        );
      });
    void loadCallerRole().then(setCallerRole);
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!dashboard) return <p>Loading dashboard…</p>;

  return (
    <>
      {renderDashboard(dashboard)}
      <section aria-label="Integrations">
        <button
          type="button"
          onClick={() => {
            setRefreshError(undefined);
            void refreshIntegrations()
              .then((refreshes) => {
                const failed = refreshes.filter(
                  ({ status }) => status === "failed",
                );
                if (failed.length > 0) {
                  setRefreshError(
                    failed
                      .map(
                        ({ cardId, message }) =>
                          `${cardId}: ${message ?? "failed"}`,
                      )
                      .join(", "),
                  );
                }
              })
              .catch((reason: unknown) =>
                setRefreshError(
                  reason instanceof Error ? reason.message : "Refresh failed",
                ),
              );
          }}
        >
          Refresh
        </button>
        {refreshError ? <p role="alert">{refreshError}</p> : null}
      </section>
      <details>
        <summary>Settings</summary>
        <Settings
          dashboard={dashboard}
          callerRole={callerRole}
          onSave={async (mutations) =>
            setDashboard(await applyDashboardMutations(mutations))
          }
        />
      </details>
    </>
  );
}
