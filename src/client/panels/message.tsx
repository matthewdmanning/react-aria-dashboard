import { createElement } from "react";

import type { PanelDefinition } from "../../dashboard";
import { panelKindSchemas } from "../../dashboard/panel-kinds";

export interface MessagePanelData {
  message: string;
}

export const messagePanel: PanelDefinition<MessagePanelData> = {
  schema: panelKindSchemas.message,
  Component: ({ data }) => createElement("p", null, data.message),
};
