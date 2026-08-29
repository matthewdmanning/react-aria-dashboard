import type { MessageCardData } from "../cards/message";

export function formatMessage(source: unknown): MessageCardData {
  return { message: (source as { text: string }).text };
}
