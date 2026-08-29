import type { PanelDefinition } from "../../dashboard";
import type { panelKindSchemas } from "../../dashboard/panel-kinds";

export { calendarPanel, cardsPanel, chartPanel, tablePanel } from "./display";
export { messagePanel } from "./message";

import { calendarPanel, cardsPanel, chartPanel, tablePanel } from "./display";
import { messagePanel } from "./message";

export const includedPanelDefinitions: Record<
  keyof typeof panelKindSchemas,
  PanelDefinition<any>
> = {
  message: messagePanel,
  table: tablePanel,
  cards: cardsPanel,
  calendar: calendarPanel,
  chart: chartPanel,
};
