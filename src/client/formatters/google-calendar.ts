import type { CalendarCardData } from "../cards/display";

interface GoogleCalendarEvent {
  id?: unknown;
  summary?: unknown;
  start?: { dateTime?: unknown; date?: unknown };
  end?: { dateTime?: unknown; date?: unknown };
}

export function formatGoogleCalendar(source: unknown): CalendarCardData {
  const items =
    source &&
    typeof source === "object" &&
    "items" in source &&
    Array.isArray(source.items)
      ? source.items
      : [];

  return {
    events: items.map((item, index) => {
      const event = (item ?? {}) as GoogleCalendarEvent;
      const start = event.start?.dateTime ?? event.start?.date ?? "";
      const end = event.end?.dateTime ?? event.end?.date;
      return {
        id: String(event.id ?? `calendar-event-${index}`),
        title: String(event.summary ?? "Untitled event"),
        start: String(start),
        ...(end === undefined ? {} : { end: String(end) }),
      };
    }),
  };
}
