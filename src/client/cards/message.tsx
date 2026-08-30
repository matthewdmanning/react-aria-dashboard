import { createElement } from "react";
import type * as z from "zod/v4";

import type { CardDefinition } from "../../dashboard";
import { cardTemplateSchemas } from "../../dashboard/card-templates";

export type MessageCardData = z.infer<typeof cardTemplateSchemas.message>;

export const messageCard: CardDefinition<MessageCardData> = {
  schema: cardTemplateSchemas.message,
  Component: ({ data }) => createElement("p", null, data.message),
};
