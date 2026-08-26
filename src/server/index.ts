import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer as createViteServer } from "vite";

import { defaultDashboardConfiguration } from "../dashboard";
import {
  readDashboardConfiguration,
  replaceDashboardConfiguration,
} from "./dashboard-store";

export async function handleDashboardConfigurationRequest(
  request: Request,
  dashboardPath: string,
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
      return Response.json(defaultDashboardConfiguration);
    }
  }

  if (request.method === "PUT") {
    await replaceDashboardConfiguration(dashboardPath, await request.json());
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function startServer() {
  const dashboardPath =
    process.env.DASHBOARD_DATA_PATH ?? resolve(".dashboard/dashboard.json");
  const vite = await createViteServer({ server: { middlewareMode: true } });
  const server = createServer(async (request, response) => {
    if (request.url === "/api/dashboard-configuration") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const result = await handleDashboardConfigurationRequest(
          new Request(`http://dashboard${request.url}`, {
            method: request.method,
            body: chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined,
          }),
          dashboardPath,
        );
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end(error instanceof Error ? error.message : "Invalid request");
      }
      return;
    }

    vite.middlewares(request, response, () => undefined);
  });

  server.listen(Number(process.env.PORT ?? 5173), "127.0.0.1");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startServer();
}
