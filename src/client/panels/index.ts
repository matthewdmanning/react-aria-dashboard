export {
  calendarPanel,
  cardsPanel,
  chartPanel,
  tablePanel,
} from "./display";
export { messagePanel } from "./message";

import { calendarPanel, cardsPanel, chartPanel, tablePanel } from "./display";
import { messagePanel } from "./message";

export const includedPanelDefinitions = {
  message: messagePanel,
  table: tablePanel,
  cards: cardsPanel,
  calendar: calendarPanel,
  chart: chartPanel,
};
