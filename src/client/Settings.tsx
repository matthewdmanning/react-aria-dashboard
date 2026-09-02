import { useState, type FormEvent } from "react";

import type {
  DashboardConfiguration,
  Integration,
  Mutation,
  Role,
  Theme,
} from "../contract";

export type DashboardSettings = Pick<
  DashboardConfiguration,
  "integrations" | "themes" | "fontScale"
> & {
  dashboard: DashboardConfiguration["dashboard"];
};

function mutationsFor(
  configuration: DashboardConfiguration,
  settings: DashboardSettings,
): Mutation[] {
  const mutations: Mutation[] = [];

  if (settings.dashboard.theme !== configuration.dashboard.theme) {
    mutations.push({
      type: "edit-dashboard",
      permission: "presentation",
      dashboard: settings.dashboard,
    });
  }
  if (settings.fontScale !== configuration.fontScale) {
    mutations.push({
      type: "set-font-scale",
      permission: "presentation",
      fontScale: settings.fontScale,
    });
  }

  const initialThemes = new Map(
    configuration.themes.map((theme) => [theme.id, theme]),
  );
  const currentThemeIds = new Set(settings.themes.map(({ id }) => id));
  for (const theme of settings.themes) {
    const initial = initialThemes.get(theme.id);
    if (!initial) {
      mutations.push({
        type: "add-theme",
        permission: "presentation",
        theme,
      });
    } else if (JSON.stringify(initial) !== JSON.stringify(theme)) {
      mutations.push({ type: "edit-theme", permission: "presentation", theme });
    }
  }
  for (const theme of configuration.themes) {
    if (!currentThemeIds.has(theme.id)) {
      mutations.push({
        type: "remove-theme",
        permission: "presentation",
        themeId: theme.id,
      });
    }
  }

  const initialIntegrations = new Map(
    configuration.integrations.map((integration) => [integration.id, integration]),
  );
  const currentIds = new Set(settings.integrations.map(({ id }) => id));

  for (const integration of settings.integrations) {
    const initial = initialIntegrations.get(integration.id);
    if (!initial) {
      mutations.push({
        type: "add-integration",
        permission: "integrations",
        integration,
      });
    } else if (JSON.stringify(initial) !== JSON.stringify(integration)) {
      mutations.push({
        type: "edit-integration",
        permission: "integrations",
        integration,
      });
    }
  }

  for (const integration of configuration.integrations) {
    if (!currentIds.has(integration.id)) {
      mutations.push({
        type: "remove-integration",
        permission: "integrations",
        integrationId: integration.id,
      });
    }
  }

  return mutations;
}

export function Settings({
  configuration,
  roles,
  onSave,
}: {
  configuration: DashboardConfiguration;
  roles?: Role[];
  onSave: (mutations: readonly Mutation[]) => Promise<void>;
}) {
  const [settings, setSettings] = useState<DashboardSettings>({
    dashboard: configuration.dashboard,
    integrations: configuration.integrations,
    themes: configuration.themes,
    fontScale: configuration.fontScale,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const mutations = mutationsFor(configuration, settings);
    if (mutations.length > 0) void onSave(mutations);
  }

  function updateIntegration(id: string, update: (integration: Integration) => Integration) {
    setSettings({
      ...settings,
      integrations: settings.integrations.map((integration) =>
        integration.id === id ? update(integration) : integration,
      ),
    });
  }

  function updateTheme(id: string, update: (theme: Theme) => Theme) {
    setSettings({
      ...settings,
      themes: settings.themes.map((theme) =>
        theme.id === id ? update(theme) : theme,
      ),
    });
  }

  const selectedTheme = settings.themes.find(
    ({ id }) => id === settings.dashboard.theme,
  );

  return (
    <form aria-label="Settings" onSubmit={submit}>
      <h2>Settings</h2>
      <fieldset>
        <legend>Theme</legend>
        <label>
          Selected theme
          <select
            value={settings.dashboard.theme}
            onChange={(event) =>
              setSettings({
                ...settings,
                dashboard: {
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
        <button
          type="button"
          onClick={() => {
            let id = `theme-${settings.themes.length + 1}`;
            while (settings.themes.some((theme) => theme.id === id)) {
              id = `${id}-new`;
            }
            setSettings({
              ...settings,
              themes: [...settings.themes, { id, settings: {} }],
            });
          }}
        >
          Add theme
        </button>
        {settings.themes.map((theme) => (
          <div key={theme.id}>
            <span>{theme.id}</span>
            <button
              type="button"
              onClick={() =>
                setSettings({
                  ...settings,
                  themes: settings.themes.filter(({ id }) => id !== theme.id),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </fieldset>
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
                  updateIntegration(integration.id, (item) => ({
                    ...item,
                    settings: {
                      ...item.settings,
                      calendarId: event.currentTarget.value,
                    },
                  }))
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
      {roles && roles.length > 0 ? (
        <fieldset>
          <legend>Agent permissions</legend>
          {roles.map((role) => (
            <div key={role.name}>
              <h3>{role.name}</h3>
              {Object.entries(role.permissions).map(([permission, level]) => (
                <p key={permission}>
                  {permission}: {level}
                </p>
              ))}
            </div>
          ))}
        </fieldset>
      ) : null}
      <button type="submit">Save settings</button>
    </form>
  );
}
