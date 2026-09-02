import { useEffect, useState } from "react";

import type { DashboardConfiguration, Role } from "../contract";
import {
  applyDashboardMutations,
  loadDashboardConfiguration,
  loadDashboardRoles,
} from "./dashboard-configuration-client";
import {
  loadGoogleCalendarSource,
  refreshGoogleCalendar,
} from "./google-calendar-client";
import { includedCardTemplates } from "./cards";
import { Settings } from "./Settings";

function renderDashboard(configuration: DashboardConfiguration) {
  const cards = new Map(configuration.cards.map((card) => [card.id, card]));

  return (
    <main
      data-theme={configuration.dashboard.theme}
      style={{ fontSize: `${configuration.fontScale}rem` }}
    >
      {configuration.dashboard.cards.map((cardId) => {
        const card = cards.get(cardId)!;
        const Component = includedCardTemplates[card.template].Component;
        return (
          <section key={card.id}>
            <h2>{card.title}</h2>
            <Component data={card.state as never} />
          </section>
        );
      })}
    </main>
  );
}

export function App() {
  const [configuration, setConfiguration] =
    useState<DashboardConfiguration>();
  const [roles, setRoles] = useState<Role[]>();
  const [calendarError, setCalendarError] = useState<string>();

  useEffect(() => {
    void loadDashboardConfiguration().then(setConfiguration);
    void loadDashboardRoles().then(setRoles);
    void loadGoogleCalendarSource().catch((error: unknown) => {
      setCalendarError(
        error instanceof Error ? error.message : "Calendar unavailable",
      );
    });
  }, []);

  if (!configuration) return <p>Loading dashboard…</p>;

  return (
    <>
      {renderDashboard(configuration)}
      <section aria-label="Google Calendar controls">
        <button
          type="button"
          onClick={() =>
            void refreshGoogleCalendar().catch((error: unknown) =>
              setCalendarError(
                error instanceof Error
                  ? error.message
                  : "Calendar refresh failed",
              ),
            )
          }
        >
          Refresh Google Calendar
        </button>
        {calendarError ? <p role="alert">{calendarError}</p> : null}
      </section>
      <details>
        <summary>Settings</summary>
        <Settings
          configuration={configuration}
          roles={roles}
          onSave={async (mutations) =>
            setConfiguration(await applyDashboardMutations(mutations))
          }
        />
      </details>
    </>
  );
}
