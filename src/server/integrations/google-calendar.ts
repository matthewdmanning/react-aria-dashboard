import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { parseDashboardConfiguration } from "../../dashboard";
import { readDashboardConfiguration } from "../dashboard-store";

export type GoogleCalendarTokenProvider = () => Promise<string>;
export type FetchCalendar = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface GoogleCalendarPullOptions {
  configurationPath: string;
  dataPath: string;
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
  integrationId?: string;
}

function calendarIdFromConfiguration(
  configuration: ReturnType<typeof parseDashboardConfiguration>,
  integrationId?: string,
) {
  const integration = configuration.integrations.find(
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

export async function readGoogleCalendarSource(
  dataPath: string,
): Promise<unknown> {
  try {
    return JSON.parse(await readFile(dataPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function pullGoogleCalendar({
  configurationPath,
  dataPath,
  tokenProvider,
  fetch: fetchCalendar = globalThis.fetch,
  integrationId,
}: GoogleCalendarPullOptions): Promise<unknown> {
  const configuration = await readDashboardConfiguration(configurationPath);
  const calendarId = calendarIdFromConfiguration(configuration, integrationId);
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
