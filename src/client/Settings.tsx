import { useState, type FormEvent } from "react";

import {
  parseDashboardConfiguration,
  type DashboardConfiguration,
} from "../dashboard";

export type DashboardSettings = Pick<
  DashboardConfiguration,
  "integrations" | "theme" | "fontScale" | "agentPermissions"
>;

export async function saveDashboardSettings(
  configuration: DashboardConfiguration,
  settings: DashboardSettings,
  save: (configuration: DashboardConfiguration) => Promise<void>,
): Promise<DashboardConfiguration> {
  const next = parseDashboardConfiguration({ ...configuration, ...settings });
  await save(next);
  return next;
}

export function Settings({
  configuration,
  themes,
  onSave,
}: {
  configuration: DashboardConfiguration;
  themes: string[];
  onSave: (settings: DashboardSettings) => Promise<void>;
}) {
  const [settings, setSettings] = useState<DashboardSettings>({
    integrations: configuration.integrations,
    theme: configuration.theme,
    fontScale: configuration.fontScale,
    agentPermissions: configuration.agentPermissions,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSave(settings);
  }

  return (
    <form aria-label="Settings" onSubmit={submit}>
      <h2>Settings</h2>
      <label>
        Theme
        <select
          value={settings.theme}
          onChange={(event) =>
            setSettings({ ...settings, theme: event.currentTarget.value })
          }
        >
          {themes.map((theme) => (
            <option key={theme}>{theme}</option>
          ))}
        </select>
      </label>
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
      <fieldset>
        <legend>Integrations</legend>
        {settings.integrations.map((integration) => (
          <div key={integration.id}>
            <label>
              Calendar ID
              <input
                value={String(integration.settings.calendarId ?? "")}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    integrations: settings.integrations.map((item) =>
                      item.id === integration.id
                        ? {
                            ...item,
                            settings: {
                              ...item.settings,
                              calendarId: event.currentTarget.value,
                            },
                          }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  integrations: settings.integrations.filter(
                    ({ id }) => id !== integration.id,
                  ),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSettings({
              ...settings,
              integrations: [
                ...settings.integrations,
                {
                  id: `google-calendar-${settings.integrations.length + 1}`,
                  type: "google-calendar",
                  settings: { calendarId: "" },
                },
              ],
            })
          }
        >
          Add Google Calendar
        </button>
      </fieldset>
      <fieldset>
        <legend>Agent permissions</legend>
        {(
          ["configuration", "artifacts", "data"] as const
        ).map((permission) => (
          <label key={permission}>
            {permission}
            <select
              value={settings.agentPermissions[permission]}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  agentPermissions: {
                    ...settings.agentPermissions,
                    [permission]: event.currentTarget.value as
                      | "none"
                      | "read"
                      | "write",
                  },
                })
              }
            >
              <option value="none">None</option>
              <option value="read">Read</option>
              <option value="write">Read and write</option>
            </select>
          </label>
        ))}
      </fieldset>
      <button type="submit">Save settings</button>
    </form>
  );
}
