import { updateDashboardDataSource } from "../dashboard-store";

interface CalendarFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type CalendarFetch = (url: URL) => Promise<CalendarFetchResponse>;

interface PublicCalendarOptions {
  dashboardPath: string;
  dataSourceId: string;
  calendarId: string;
  accessKey: string;
  timeMin?: string;
  timeMax?: string;
  fetchCalendar?: CalendarFetch;
}

interface PublicCalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function eventDate(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.dateTime === "string"
    ? value.dateTime
    : typeof value.date === "string"
      ? value.date
      : undefined;
}

export async function pullPublicGoogleCalendar({
  dashboardPath,
  dataSourceId,
  calendarId,
  accessKey,
  timeMin,
  timeMax,
  fetchCalendar = (url) => fetch(url),
}: PublicCalendarOptions): Promise<{ events: PublicCalendarEvent[] }> {
  if (!accessKey) throw new Error("Google Calendar API key not configured");

  const events: PublicCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    url.searchParams.set("key", accessKey);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("showDeleted", "false");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "2500");
    if (timeMin) url.searchParams.set("timeMin", timeMin);
    if (timeMax) url.searchParams.set("timeMax", timeMax);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetchCalendar(url);
    if (!response.ok) {
      throw new Error(`Google Calendar pull failed: ${response.status}`);
    }

    const payload = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.items)) {
      throw new Error("Google Calendar returned invalid event data");
    }

    for (const item of payload.items) {
      if (!isRecord(item)) {
        throw new Error("Google Calendar returned invalid event data");
      }
      const start = eventDate(item.start);
      if (typeof item.id !== "string" || !start) {
        throw new Error("Google Calendar returned invalid event data");
      }
      const end = eventDate(item.end);
      events.push({
        id: item.id,
        title: typeof item.summary === "string" ? item.summary : "Untitled event",
        start,
        ...(end ? { end } : {}),
      });
    }

    pageToken =
      typeof payload.nextPageToken === "string"
        ? payload.nextPageToken
        : undefined;
  } while (pageToken);

  const data = { events };
  await updateDashboardDataSource(dashboardPath, dataSourceId, data);
  return data;
}
