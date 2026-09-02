import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { Integration } from "../../contract";

export type GoogleCalendarTokenProvider = () => Promise<string>;
export type FetchCalendar = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface GoogleCalendarPullOptions {
  integrations: Integration[];
  dataPath: string;
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
  integrationId?: string;
}

function calendarIdFromIntegrations(
  integrations: Integration[],
  integrationId?: string,
) {
  const integration = integrations.find(
    (candidate) =>
      candidate.type === "google-calendar" &&
      (integrationId === undefined || candidate.id === integrationId),
  );
  const calendarId = integration?.settings.calendarId;
  if (typeof calendarId !== "string" || calendarId.length === 0) {
    throw new Error("No configured Google Calendar integration");
  }
  return calendarId;
}

async function writeAtomically(path: string, content: string) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(temporaryPath, content);
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function pullGoogleCalendar({
  integrations,
  dataPath,
  tokenProvider,
  fetch: fetchCalendar = globalThis.fetch,
  integrationId,
}: GoogleCalendarPullOptions): Promise<unknown> {
  const calendarId = calendarIdFromIntegrations(integrations, integrationId);
  const token = await tokenProvider();
  const response = await fetchCalendar(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new Error(`Google Calendar pull failed: ${response.status}`);

  const source = await response.json();
  await writeAtomically(dataPath, `${JSON.stringify(source, null, 2)}\n`);
  return source;
}
