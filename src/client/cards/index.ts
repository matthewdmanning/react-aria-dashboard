import type { CardDefinition } from "../../dashboard";
import type { cardVariantSchemas } from "../../dashboard/card-variants";

export { calendarCard, listCard, chartCard, tableCard } from "./display";
export { messageCard } from "./message";

import { calendarCard, listCard, chartCard, tableCard } from "./display";
import { messageCard } from "./message";

export const includedCardDefinitions: Record<
  keyof typeof cardVariantSchemas,
  CardDefinition<any>
> = {
  message: messageCard,
  table: tableCard,
  list: listCard,
  calendar: calendarCard,
  chart: chartCard,
};
