import type { MessagePanelData } from "../panels/message";

export function formatMessage(source: unknown): MessagePanelData {
  return { message: (source as { text: string }).text };
}
