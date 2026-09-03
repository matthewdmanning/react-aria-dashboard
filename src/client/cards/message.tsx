import { createElement } from "react";
import type * as z from "zod/v4";

import { cardTemplateSchemas } from "../../contract";
import type { CardTemplate } from "./index";

export type MessageCardData = z.infer<typeof cardTemplateSchemas.message>;

export const messageCard: CardTemplate<MessageCardData> = {
  schema: cardTemplateSchemas.message,
  Component: ({ data }) => createElement("p", null, data.message),
};
