export async function loadGoogleCalendarSource(): Promise<unknown | undefined> {
  const response = await fetch("/api/google-calendar");
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error("Could not load Google Calendar data");
  return response.json();
}

export async function refreshGoogleCalendar(): Promise<unknown> {
  const response = await fetch("/api/google-calendar", { method: "POST" });
  if (!response.ok) throw new Error("Could not refresh Google Calendar");
  return response.json();
}
