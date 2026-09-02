import type { ComponentType } from "react";
import type * as z from "zod/v4";
import type { cardTemplateSchemas } from "../../contract";

export interface CardTemplate<T> {
  schema: z.ZodType<T>;
  Component: ComponentType<{ data: T }>;
}

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
