export type GoogleCalendarTokenProvider = () => Promise<string>;
export type FetchCalendar = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface GoogleCalendarPullOptions {
  query: unknown;
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
}

function calendarIdFromQuery(query: unknown): string {
  const calendarId =
    query !== null && typeof query === "object" && "calendarId" in query
      ? (query as { calendarId: unknown }).calendarId
      : undefined;
  if (typeof calendarId !== "string" || calendarId.length === 0) {
    throw new Error("Query is missing a calendarId");
  }
  return calendarId;
}

export async function pullGoogleCalendar({
  query,
  tokenProvider,
  fetch: fetchCalendar = globalThis.fetch,
}: GoogleCalendarPullOptions): Promise<unknown> {
  const calendarId = calendarIdFromQuery(query);
  const token = await tokenProvider();
  const response = await fetchCalendar(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new Error(`Google Calendar pull failed: ${response.status}`);

  return response.json();
}
