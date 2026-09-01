import { createElement } from "react";
import type * as z from "zod/v4";

import type { CardTemplate } from "../../dashboard";
import { cardTemplateSchemas } from "../../contract";

export type MessageCardData = z.infer<typeof cardTemplateSchemas.message>;

export const messageCard: CardTemplate<MessageCardData> = {
  schema: cardTemplateSchemas.message,
  Component: ({ data }) => createElement("p", null, data.message),
};
