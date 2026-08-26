import { renderDashboard, type DashboardConfiguration } from "../dashboard";
import { formatMessage } from "./formatters/message";
import { messagePanel } from "./panels/message";

const configuration: DashboardConfiguration = {
  version: 1,
  integrations: [],
  theme: "calm",
  fontScale: 1,
  agentPermissions: {
    configuration: "read",
    artifacts: "none",
    data: "none",
  },
  panels: [{ id: "welcome", title: "Dashboard", definition: "message" }],
  wiring: [{ panelId: "welcome", source: "welcome", formatter: "message" }],
  arrangement: ["welcome"],
};

export function App() {
  return renderDashboard(configuration, {
    panelDefinitions: { message: messagePanel },
    sources: { welcome: { text: "Dashboard architecture is ready." } },
    formatters: { message: formatMessage },
  });
}
