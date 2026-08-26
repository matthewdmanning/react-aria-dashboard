import { useEffect, useState } from "react";

import { renderDashboard, type DashboardConfiguration } from "../dashboard";
import {
  loadDashboardConfiguration,
  saveDashboardConfiguration,
} from "./dashboard-configuration-client";
import { formatMessage } from "./formatters/message";
import { includedPanelDefinitions } from "./panels";
import { saveDashboardSettings, Settings } from "./Settings";

export function App() {
  const [configuration, setConfiguration] =
    useState<DashboardConfiguration>();

  useEffect(() => {
    void loadDashboardConfiguration().then(setConfiguration);
  }, []);

  if (!configuration) return <p>Loading dashboard…</p>;

  return (
    <>
      {renderDashboard(configuration, {
        panelDefinitions: includedPanelDefinitions,
        sources: { welcome: { text: "Dashboard architecture is ready." } },
        formatters: { message: formatMessage },
      })}
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
