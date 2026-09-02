import { useState, type FormEvent } from "react";

import type { Mutation, ReadableDashboard, Theme } from "../contract";
import {
  settingsMutations,
  type DashboardSettings,
} from "./settings-mutations";

export function Settings({
  dashboard,
  onSave,
}: {
  dashboard: ReadableDashboard;
  onSave: (mutations: readonly Mutation[]) => Promise<void>;
}) {
  const initial: DashboardSettings = {
    dashboard: dashboard.dashboard,
    integrations: dashboard.integrations,
    themes: dashboard.themes,
    fontScale: dashboard.fontScale,
  };
  const [settings, setSettings] = useState<DashboardSettings>(initial);
  const [connection, setConnection] = useState({ id: "", type: "" });
  const [error, setError] = useState<string>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const mutations = settingsMutations(initial, settings);
    if (mutations.length === 0) return;

    setError(undefined);
    void onSave(mutations).catch((reason: unknown) => {
      setError(
        reason instanceof Error ? reason.message : "Could not save settings",
      );
    });
  }

  function updateTheme(id: string, update: (theme: Theme) => Theme) {
    setSettings({
      ...settings,
      themes: settings.themes?.map((theme) =>
        theme.id === id ? update(theme) : theme,
      ),
    });
  }

  const selectedTheme = settings.themes?.find(
    ({ id }) => id === settings.dashboard?.theme,
  );

  return (
    <form aria-label="Settings" onSubmit={submit}>
      <h2>Settings</h2>

      {settings.dashboard && settings.themes ? (
        <fieldset>
          <legend>Theme</legend>
          <label>
            Selected theme
            <select
              value={settings.dashboard.theme}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  dashboard: settings.dashboard && {
                    ...settings.dashboard,
                    theme: event.currentTarget.value,
                  },
                })
              }
            >
              {settings.themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.id}
                </option>
              ))}
            </select>
          </label>
          {selectedTheme ? (
            <label>
              Density
              <select
                value={String(selectedTheme.settings.density ?? "")}
                onChange={(event) =>
                  updateTheme(selectedTheme.id, (theme) => ({
                    ...theme,
                    settings: {
                      ...theme.settings,
                      density: event.currentTarget.value,
                    },
                  }))
                }
              >
                <option value="">Default</option>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          ) : null}
          {settings.themes.map((theme) => (
            <div key={theme.id}>
              <span>{theme.id}</span>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    themes: settings.themes?.filter(
                      ({ id }) => id !== theme.id,
                    ),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </fieldset>
      ) : null}

      {settings.fontScale !== undefined ? (
        <label>
          Font scale
          <input
            type="range"
            min="0.75"
            max="2"
            step="0.05"
            value={settings.fontScale}
            onChange={(event) =>
              setSettings({
                ...settings,
                fontScale: event.currentTarget.valueAsNumber,
              })
            }
          />
        </label>
      ) : null}

      {/*
        Connecting an integration authorizes this dashboard to use an external
        service. It does not configure what a card shows — that is a card's
        query. So this panel names the connection and never its fields, and
        knows no integration type of its own.
      */}
      {settings.integrations ? (
        <fieldset>
          <legend>Integrations</legend>
          {settings.integrations.map((integration) => (
            <div key={integration.id}>
              <span>{integration.id}</span>
              <span>{integration.type}</span>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    integrations: settings.integrations?.filter(
                      ({ id }) => id !== integration.id,
                    ),
                  })
                }
              >
                Disconnect
              </button>
            </div>
          ))}
          <label>
            Name
            <input
              value={connection.id}
              onChange={(event) =>
                setConnection({ ...connection, id: event.currentTarget.value })
              }
            />
          </label>
          <label>
            Service
            <input
              value={connection.type}
              onChange={(event) =>
                setConnection({
                  ...connection,
                  type: event.currentTarget.value,
                })
              }
            />
          </label>
          <button
            type="button"
            disabled={connection.id === "" || connection.type === ""}
            onClick={() => {
              setSettings({
                ...settings,
                integrations: [
                  ...(settings.integrations ?? []),
                  { id: connection.id, type: connection.type, settings: {} },
                ],
              });
              setConnection({ id: "", type: "" });
            }}
          >
            Connect
          </button>
        </fieldset>
      ) : null}

      {dashboard.roles ? (
        <fieldset>
          <legend>Roles</legend>
          {dashboard.roles.map((role) => (
            <div key={role.name}>
              <h3>{role.name}</h3>
              {Object.entries(role.permissions).map(([category, level]) => (
                <p key={category}>
                  {category}: {level}
                </p>
              ))}
            </div>
          ))}
        </fieldset>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">Save settings</button>
    </form>
  );
}
