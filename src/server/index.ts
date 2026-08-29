import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer as createViteServer } from "vite";

import { defaultDashboardConfiguration } from "../dashboard";
import {
  readDashboardConfiguration,
  replaceDashboardConfiguration,
} from "./dashboard-store";
import {
  pullGoogleCalendar,
  readGoogleCalendarSource,
  type FetchCalendar,
  type GoogleCalendarTokenProvider,
} from "./integrations/google-calendar";

export async function handleDashboardConfigurationRequest(
  request: Request,
  dashboardPath: string,
  dataPath?: string,
): Promise<Response> {
  if (request.method === "GET") {
    try {
      return Response.json(await readDashboardConfiguration(dashboardPath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await replaceDashboardConfiguration(
        dashboardPath,
        defaultDashboardConfiguration,
      );
      if (dataPath) {
        await mkdir(dataPath, { recursive: true });
        await writeFile(
          join(dataPath, "welcome.json"),
          JSON.stringify({ text: "Dashboard architecture is ready." }),
        );
      }
      return Response.json(defaultDashboardConfiguration);
    }
  }

  if (request.method === "PUT") {
    await replaceDashboardConfiguration(dashboardPath, await request.json());
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
}

export async function handleSourcesRequest(
  request: Request,
  dashboardPath: string,
  dataPath: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const configuration = await readDashboardConfiguration(dashboardPath).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return defaultDashboardConfiguration;
    },
  );
  const sourceIds = new Set(configuration.wiring.map(({ source }) => source));
  const sources: Record<string, unknown> = {};
  await Promise.all(
    [...sourceIds].map(async (id) => {
      try {
        sources[id] = JSON.parse(
          await readFile(join(dataPath, `${id}.json`), "utf8"),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }),
  );
  return Response.json(sources);
}

export async function handleGoogleCalendarRequest(
  request: Request,
  configurationPath: string,
  dataPath: string,
  dependencies: {
    tokenProvider: GoogleCalendarTokenProvider;
    fetch?: FetchCalendar;
  },
): Promise<Response> {
  if (request.method === "GET") {
    const source = await readGoogleCalendarSource(dataPath);
    return source === undefined
      ? new Response(null, { status: 404 })
      : Response.json(source);
  }
  if (request.method === "POST") {
    return Response.json(
      await pullGoogleCalendar({
        ...dependencies,
        configurationPath,
        dataPath,
      }),
    );
  }
  return new Response("Method not allowed", { status: 405 });
}

async function startServer() {
  const dashboardPath =
    process.env.DASHBOARD_DATA_PATH ?? resolve(".dashboard/dashboard.json");
  const calendarDataPath =
    process.env.DASHBOARD_CALENDAR_DATA_PATH ??
    resolve(".dashboard/google-calendar.json");
  // Must match the MCP server's data directory (src/mcp/operations.ts's
  // dataFilePath) so a card wired to a source that edit-data-file wrote
  // is actually visible here.
  const dataPath = resolve(process.env.DASHBOARD_WORKSPACE ?? ".", "data");
  const tokenProvider: GoogleCalendarTokenProvider = async () => {
    throw new Error("Google Calendar credentials are not configured");
  };
  const vite = await createViteServer({ server: { middlewareMode: true } });
  const server = createServer(async (request, response) => {
    if (request.url === "/api/dashboard-configuration") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const result = await handleDashboardConfigurationRequest(
          new Request(`http://dashboard${request.url}`, {
            method: request.method,
            body: chunks.length
              ? Buffer.concat(chunks).toString("utf8")
              : undefined,
          }),
          dashboardPath,
          dataPath,
        );
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end(
          error instanceof Error ? error.message : "Invalid request",
        );
      }
      return;
    }

    if (request.url === "/api/sources") {
      try {
        const result = await handleSourcesRequest(
          new Request(`http://dashboard${request.url}`, {
            method: request.method,
          }),
          dashboardPath,
          dataPath,
        );
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end(
          error instanceof Error ? error.message : "Invalid request",
        );
      }
      return;
    }

    if (request.url === "/api/google-calendar") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const result = await handleGoogleCalendarRequest(
          new Request(`http://dashboard${request.url}`, {
            method: request.method,
            body: chunks.length
              ? Buffer.concat(chunks).toString("utf8")
              : undefined,
          }),
          dashboardPath,
          calendarDataPath,
          { tokenProvider },
        );
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end(
          error instanceof Error ? error.message : "Calendar request failed",
        );
      }
      return;
    }

    vite.middlewares(request, response, () => undefined);
  });

  server.listen(Number(process.env.PORT ?? 5173), "127.0.0.1");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void startServer();
}
