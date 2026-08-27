import { createElement } from "react";

import type { PanelDefinition } from "../../dashboard";

export interface MessagePanelData {
  message: string;
}

export const messagePanel: PanelDefinition<MessagePanelData> = {
  schema: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
    additionalProperties: false,
  },
  Component: ({ data }) => createElement("p", null, data.message),
};
