import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, test } from "vitest";

import {
  defaultDashboardConfiguration,
  type DashboardConfiguration,
} from "../contract";
import {
  createService,
  type DashboardPersistence,
  type DashboardService,
} from "../service";
import { createDashboardMcpServer } from "./server";

function createMemoryPersistence(
  initial: DashboardConfiguration,
): DashboardPersistence {
  let configuration = structuredClone(initial);
  return {
    read: async () => structuredClone(configuration),
    write: async (next) => {
      configuration = structuredClone(next);
    },
  };
}

function createTestService(
  initial: DashboardConfiguration = defaultDashboardConfiguration,
): DashboardService {
  return createService({ persistence: createMemoryPersistence(initial) });
}

/**
 * Connects a real MCP client to the server over an in-memory transport pair
 * — the module's own interface, the same way `src/server/index.test.ts`
 * drives the HTTP adapter through `Request`/`Response`.
 */
async function connectClient(service: DashboardService): Promise<Client> {
  const server = createDashboardMcpServer(service);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const [block] = result.content;
  if (!block || block.type !== "text") throw new Error("Expected text content");
  return block.text;
}

describe("dashboard MCP server", () => {
  test("exposes a tool per mutation constructor plus reading the dashboard", async () => {
    const client = await connectClient(createTestService());

    const { tools } = await client.listTools();

    expect(new Set(tools.map((tool) => tool.name))).toEqual(
      new Set([
        "read-dashboard",
        "add-card",
        "edit-card",
        "remove-card",
        "patch-card-state",
        "insert-card",
        "edit-dashboard",
        "add-theme",
        "edit-theme",
        "remove-theme",
        "set-font-scale",
        "add-integration",
        "edit-integration",
        "remove-integration",
      ]),
    );
  });

  test("reads dashboard state through the service", async () => {
    const client = await connectClient(createTestService());

    const result = await client.callTool({
      name: "read-dashboard",
      arguments: { scope: "presentation" },
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result))).toMatchObject({
      dashboard: defaultDashboardConfiguration.dashboard,
    });
  });

  test("applies a mutation through the service", async () => {
    const client = await connectClient(createTestService());

    const applied = await client.callTool({
      name: "set-font-scale",
      arguments: { fontScale: 1.25 },
    });
    expect(applied.isError).toBeFalsy();

    const read = await client.callTool({
      name: "read-dashboard",
      arguments: { scope: "presentation" },
    });
    expect(JSON.parse(text(read))).toMatchObject({ fontScale: 1.25 });
  });

  test("a denied read surfaces as an MCP error carrying the service's failure code", async () => {
    // The default `local` role has `roles: none`.
    const client = await connectClient(createTestService());

    const result = await client.callTool({
      name: "read-dashboard",
      arguments: { scope: "roles" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "permission-denied",
    });
  });

  test("a denied apply surfaces as an MCP error carrying the service's failure code", async () => {
    const restricted: DashboardConfiguration = {
      ...structuredClone(defaultDashboardConfiguration),
      roles: [
        {
          name: "local",
          permissions: {
            data: "read",
            cards: "read",
            presentation: "read",
            integrations: "read",
            roles: "none",
          },
        },
      ],
    };
    const client = await connectClient(createTestService(restricted));

    const result = await client.callTool({
      name: "set-font-scale",
      arguments: { fontScale: 1.5 },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "permission-denied",
    });
  });

  test("an unknown-id failure surfaces its own code, not a permission denial", async () => {
    const client = await connectClient(createTestService());

    const result = await client.callTool({
      name: "edit-theme",
      arguments: { theme: { id: "absent", settings: {} } },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "unknown-id" });
  });
});
