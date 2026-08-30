import { useEffect, useMemo, useState } from "react";

import {
  compileFormatterSpec,
  renderDashboard,
  type DashboardConfiguration,
} from "../dashboard";
import {
  loadDashboardConfiguration,
  loadSources,
  saveDashboardConfiguration,
} from "./dashboard-configuration-client";
import {
  loadGoogleCalendarSource,
  refreshGoogleCalendar,
} from "./google-calendar-client";
import { formatIdentity } from "./formatters/identity";
import { formatMessage } from "./formatters/message";
import { includedCardTemplates } from "./cards";
import { saveDashboardSettings, Settings } from "./Settings";
import { formatGoogleCalendar } from "./formatters/google-calendar";

export function App() {
  const [configuration, setConfiguration] = useState<DashboardConfiguration>();
  const [sources, setSources] = useState<Record<string, unknown>>();
  const [calendarSource, setCalendarSource] = useState<unknown>();
  const [calendarError, setCalendarError] = useState<string>();

  useEffect(() => {
    void loadDashboardConfiguration().then(setConfiguration);
    void loadSources().then(setSources);
    void loadGoogleCalendarSource()
      .then(setCalendarSource)
      .catch((error: unknown) => {
        setCalendarError(
          error instanceof Error ? error.message : "Calendar unavailable",
        );
      });
  }, []);

  const formatters = useMemo(
    () => ({
      identity: formatIdentity,
      message: formatMessage,
      "google-calendar": formatGoogleCalendar,
      ...Object.fromEntries(
        Object.entries(configuration?.formatterSpecs ?? {}).map(
          ([id, spec]) => [id, compileFormatterSpec(spec)],
        ),
      ),
    }),
    [configuration?.formatterSpecs],
  );

  if (!configuration || !sources) return <p>Loading dashboard…</p>;

  return (
    <>
      {renderDashboard(configuration, {
        cardTemplates: includedCardTemplates,
        sources: { ...sources, "google-calendar": calendarSource },
        formatters,
      })}
      <section aria-label="Google Calendar controls">
        <button
          type="button"
          onClick={() =>
            void refreshGoogleCalendar()
              .then(setCalendarSource)
              .then(() => setCalendarError(undefined))
              .catch((error: unknown) =>
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
          themes={["calm", "contrast"]}
          onSave={async (settings) =>
            setConfiguration(
              await saveDashboardSettings(
                configuration,
                settings,
                saveDashboardConfiguration,
              ),
            )
          }
        />
      </details>
    </>
  );
}
