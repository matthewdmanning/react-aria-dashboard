import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer as createViteServer } from "vite";

import { createFileAccountStore } from "../auth";
import type { Mutation } from "../contract";
import {
  createFilePersistence,
  createService,
  type DashboardService,
} from "../service";
import {
  pullGoogleCalendar,
  readGoogleCalendarSource,
  type FetchCalendar,
  type GoogleCalendarTokenProvider,
} from "./integrations/google-calendar";

const readScopes = [
  "all",
  "data",
  "cards",
  "presentation",
  "integrations",
  "roles",
] as const;

export async function handleDashboardConfigurationRequest(
  request: Request,
  service: DashboardService,
): Promise<Response> {
  try {
    if (request.method === "GET") {
      const scope = new URL(request.url).searchParams.get("scope") ?? "all";
      if (!(readScopes as readonly string[]).includes(scope)) {
        return new Response("Unknown dashboard scope", { status: 400 });
      }
      return Response.json(
        await readDashboardScope(service, scope as (typeof readScopes)[number], request),
      );
    }

    if (request.method === "POST") {
      return Response.json(
        await service.apply(
          (await request.json()) as readonly Mutation[],
          credentialFromRequest(request),
        ),
      );
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Invalid request", {
      status: isAuthorizationError(error) ? 403 : 400,
    });
  }
}

async function readDashboardScope(
  service: DashboardService,
  scope: (typeof readScopes)[number],
  request: Request,
) {
  const credential = credentialFromRequest(request);
  switch (scope) {
    case "all":
      return service.read("all", credential);
    case "data":
      return service.read("data", credential);
    case "cards":
      return service.read("cards", credential);
    case "presentation":
      return service.read("presentation", credential);
    case "integrations":
      return service.read("integrations", credential);
    case "roles":
      return service.read("roles", credential);
  }
}

function credentialFromRequest(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization === null) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) throw new Error("Invalid authorization header");
  return match[1];
}

function isAuthorizationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (/^(Unknown credential|Authentication is not configured|Permission denied)/.test(
      error.message,
    ) ||
      error.message === "Invalid authorization header")
  );
}

export async function handleGoogleCalendarRequest(
  request: Request,
  dataPath: string,
  dependencies: {
    service: DashboardService;
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
        integrations: await dependencies.service.read(
          "integrations",
          credentialFromRequest(request),
        ),
        dataPath,
      }),
    );
  }
  return new Response("Method not allowed", { status: 405 });
}

async function startServer() {
  const workspace = resolve(process.env.DASHBOARD_WORKSPACE ?? ".");
  const dashboardPath =
    process.env.DASHBOARD_DATA_PATH ??
    join(workspace, ".dashboard", "dashboard.json");
  const accountPath =
    process.env.DASHBOARD_ACCOUNT_PATH ??
    join(workspace, ".dashboard", "accounts.json");
  const calendarDataPath =
    process.env.DASHBOARD_CALENDAR_DATA_PATH ??
    join(workspace, ".dashboard", "google-calendar.json");
  const service = createService({
    persistence: createFilePersistence(dashboardPath),
    accountStore: createFileAccountStore(accountPath),
  });
  const tokenProvider: GoogleCalendarTokenProvider = async () => {
    throw new Error("Google Calendar credentials are not configured");
  };
  const vite = await createViteServer({ server: { middlewareMode: true } });
  const server = createServer(async (request, response) => {
    if (request.url?.startsWith("/api/dashboard-configuration")) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const result = await handleDashboardConfigurationRequest(
          new Request(`http://dashboard${request.url}`, {
            method: request.method,
            headers: authorizationHeaders(request),
            body: chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined,
          }),
          service,
        );
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end(error instanceof Error ? error.message : "Invalid request");
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
            headers: authorizationHeaders(request),
            body: chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined,
          }),
          calendarDataPath,
          { tokenProvider, service },
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

function authorizationHeaders(request: import("node:http").IncomingMessage) {
  const authorization = request.headers.authorization;
  return typeof authorization !== "string"
    ? undefined
    : { authorization };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void startServer();
}
