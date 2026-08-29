import { createElement } from "react";
import type * as z from "zod/v4";

import type { CardDefinition } from "../../dashboard";
import { cardVariantSchemas } from "../../dashboard/card-variants";

export type MessageCardData = z.infer<typeof cardVariantSchemas.message>;

export const messageCard: CardDefinition<MessageCardData> = {
  schema: cardVariantSchemas.message,
  Component: ({ data }) => createElement("p", null, data.message),
};
