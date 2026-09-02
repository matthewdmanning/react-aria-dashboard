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

/** Each component's data type is derived from its schema, never asserted. */
export type IncludedCardTemplates = {
  [Name in keyof typeof cardTemplateSchemas]: CardTemplate<
    z.infer<(typeof cardTemplateSchemas)[Name]>
  >;
};

export const includedCardTemplates: IncludedCardTemplates = {
  message: messageCard,
  table: tableCard,
  list: listCard,
  calendar: calendarCard,
  chart: chartCard,
};
