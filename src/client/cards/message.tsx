import { createElement } from "react";

import type { CardDefinition } from "../../dashboard";
import { cardVariantSchemas } from "../../dashboard/card-variants";

export interface MessageCardData {
  message: string;
}

export const messageCard: CardDefinition<MessageCardData> = {
  schema: cardVariantSchemas.message,
  Component: ({ data }) => createElement("p", null, data.message),
};
