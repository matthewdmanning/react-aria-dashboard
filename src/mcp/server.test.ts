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
import type { CredentialStore } from "../server/integrations/credentials";
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

function createMemoryCredentialStore(): CredentialStore {
  const values = new Map<string, string>();
  return {
    get: async (id) => values.get(id),
    set: async (id, credential) => {
      values.set(id, credential);
    },
    remove: async (id) => {
      values.delete(id);
    },
  };
}

function createTestService(
  initial: DashboardConfiguration = defaultDashboardConfiguration,
  extra: { credentials?: CredentialStore; connectableTypes?: string[] } = {},
): DashboardService {
  return createService({
    persistence: createMemoryPersistence(initial),
    ...extra,
  });
}

/**
 * Connects a real MCP client to the server over an in-memory transport pair
 * — the module's own interface, the same way `src/server/index.test.ts`
 * drives the HTTP adapter through `Request`/`Response`.
 */
async function connectClient(service: DashboardService): Promise<Client> {
  const server = createDashboardMcpServer(service);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
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
        "authorize-integration",
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

describe("integration authorization through MCP", () => {
  test("authorizes a connection through the same enforcement point as the HTTP adapter", async () => {
    const credentials = createMemoryCredentialStore();
    const client = await connectClient(
      createTestService(
        {
          ...defaultDashboardConfiguration,
          integrations: [
            { id: "team-calendar", type: "google-calendar", settings: {} },
          ],
        },
        { credentials },
      ),
    );

    const result = await client.callTool({
      name: "authorize-integration",
      arguments: { integrationId: "team-calendar", credential: "secret-token" },
    });

    expect(result.isError).toBeFalsy();
    await expect(credentials.get("team-calendar")).resolves.toBe(
      "secret-token",
    );
  });

  test("a role below integrations: edit is refused, the same as through HTTP", async () => {
    const credentials = createMemoryCredentialStore();
    const restricted: DashboardConfiguration = {
      ...structuredClone(defaultDashboardConfiguration),
      roles: [
        {
          name: "local",
          permissions: {
            data: "write",
            cards: "write",
            presentation: "write",
            integrations: "read",
            roles: "none",
          },
        },
      ],
    };
    const client = await connectClient(
      createTestService(restricted, { credentials }),
    );

    const result = await client.callTool({
      name: "authorize-integration",
      arguments: { integrationId: "team-calendar", credential: "secret-token" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "permission-denied",
    });
    await expect(credentials.get("team-calendar")).resolves.toBeUndefined();
  });

  test("removing an integration through MCP leaves no credential behind", async () => {
    const credentials = createMemoryCredentialStore();
    await credentials.set("team-calendar", "secret-token");
    const client = await connectClient(
      createTestService(
        {
          ...defaultDashboardConfiguration,
          integrations: [
            { id: "team-calendar", type: "google-calendar", settings: {} },
          ],
        },
        { credentials },
      ),
    );

    const result = await client.callTool({
      name: "remove-integration",
      arguments: { integrationId: "team-calendar" },
    });

    expect(result.isError).toBeFalsy();
    await expect(credentials.get("team-calendar")).resolves.toBeUndefined();
  });
});
