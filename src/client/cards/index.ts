import type { CardTemplate } from "../../dashboard";
import type { cardTemplateSchemas } from "../../contract";

export { calendarCard, listCard, chartCard, tableCard } from "./display";
export { messageCard } from "./message";

import { calendarCard, listCard, chartCard, tableCard } from "./display";
import { messageCard } from "./message";

export const includedCardTemplates: Record<
  keyof typeof cardTemplateSchemas,
  CardTemplate<any>
> = {
  message: messageCard,
  table: tableCard,
  list: listCard,
  calendar: calendarCard,
  chart: chartCard,
};
