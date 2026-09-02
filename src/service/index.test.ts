import { describe, expect, test } from "vitest";

import {
  defaultDashboardConfiguration,
  type DashboardConfiguration,
  type Mutation,
} from "../contract";
import { createService, type DashboardPersistence } from "./index";

function createMemoryPersistence(
  initial = defaultDashboardConfiguration,
): DashboardPersistence & {
  writes: DashboardConfiguration[];
} {
  let configuration = structuredClone(initial);
  const writes: DashboardConfiguration[] = [];

  return {
    writes,
    read: async () => structuredClone(configuration),
    write: async (next) => {
      configuration = structuredClone(next);
      writes.push(structuredClone(next));
    },
  };
}

function withLocalPermissions(
  permissions: DashboardConfiguration["roles"][number]["permissions"],
): DashboardConfiguration {
  return {
    ...defaultDashboardConfiguration,
    roles: [{ name: "local", permissions }],
  };
}

describe("dashboard service", () => {
  test("reads the requested state when the caller has read access", async () => {
    const persistence = createMemoryPersistence();
    const service = createService({ persistence });

    await expect(service.read("cards")).resolves.toEqual(
      defaultDashboardConfiguration.cards,
    );
  });

  test("applies authorized mutations atomically", async () => {
    const persistence = createMemoryPersistence();
    const service = createService({ persistence });
    const mutations: Mutation[] = [
      {
        type: "patch-card-state",
        cardId: "welcome",
        patch: { message: "Updated" },
      },
      {
        type: "set-font-scale",
        fontScale: 1.25,
      },
    ];

    await expect(service.apply(mutations)).resolves.toMatchObject({
      fontScale: 1.25,
      cards: [{ state: { message: "Updated" } }],
    });
    expect(persistence.writes).toHaveLength(1);
  });

  test("rejects an unauthorized mutation without persisting any mutation", async () => {
    const persistence = createMemoryPersistence(
      withLocalPermissions({
        data: "write",
        cards: "write",
        presentation: "none",
        integrations: "write",
        roles: "none",
      }),
    );
    const service = createService({ persistence });

    await expect(
      service.apply([
        {
          type: "patch-card-state",
          cardId: "welcome",
          patch: { message: "Updated" },
        },
        {
          type: "set-font-scale",
          fontScale: 1.25,
        },
      ]),
    ).rejects.toThrow("presentation: edit");
    expect(persistence.writes).toHaveLength(0);
  });

  test("lets an edit-level role change what exists but not create or destroy", async () => {
    const persistence = createMemoryPersistence(
      withLocalPermissions({
        data: "edit",
        cards: "edit",
        presentation: "edit",
        integrations: "edit",
        roles: "none",
      }),
    );
    const service = createService({ persistence });

    await expect(
      service.apply([
        {
          type: "patch-card-state",
          cardId: "welcome",
          patch: { message: "Updated" },
        },
      ]),
    ).resolves.toMatchObject({ cards: [{ state: { message: "Updated" } }] });

    await expect(
      service.apply([
        {
          type: "add-theme",
          theme: { id: "dark", settings: {} },
        },
      ]),
    ).rejects.toThrow("presentation: write");
  });

  test("resolves credentialed callers before checking their role", async () => {
    const persistence = createMemoryPersistence({
      ...defaultDashboardConfiguration,
      roles: [
        {
          name: "reader",
          permissions: {
            data: "none",
            cards: "read",
            presentation: "none",
            integrations: "none",
            roles: "none",
          },
        },
      ],
    });
    const service = createService({
      persistence,
      authStore: {
        resolve: async (credential) => {
          expect(credential).toBe("credential");
          return { credential, role: "reader" };
        },
      },
    });

    await expect(service.read("cards", "credential")).resolves.toEqual(
      defaultDashboardConfiguration.cards,
    );
  });

  test("read('all') returns only the categories the role may read", async () => {
    const service = createService({ persistence: createMemoryPersistence() });

    await expect(service.read("all")).resolves.toEqual({
      cards: defaultDashboardConfiguration.cards,
      dashboard: defaultDashboardConfiguration.dashboard,
      themes: defaultDashboardConfiguration.themes,
      fontScale: defaultDashboardConfiguration.fontScale,
      integrations: defaultDashboardConfiguration.integrations,
    });
  });

  test("tells a caller its own role however narrow that role is", async () => {
    const persistence = createMemoryPersistence({
      ...defaultDashboardConfiguration,
      roles: [
        {
          name: "local",
          permissions: {
            data: "none",
            cards: "none",
            presentation: "none",
            integrations: "none",
            roles: "none",
          },
        },
      ],
    });
    const service = createService({ persistence });

    await expect(service.read("role")).resolves.toMatchObject({
      name: "local",
      permissions: { roles: "none" },
    });
  });

  test("refuses a scoped read the role has no access to", async () => {
    const service = createService({ persistence: createMemoryPersistence() });

    await expect(service.read("roles")).rejects.toThrow("roles: read");
  });

  test("requires presentation write to remove a card a dashboard holds", async () => {
    const persistence = createMemoryPersistence(
      withLocalPermissions({
        data: "write",
        cards: "write",
        presentation: "none",
        integrations: "write",
        roles: "none",
      }),
    );
    const service = createService({ persistence });

    await expect(
      service.apply([{ type: "remove-card", cardId: "welcome" }]),
    ).rejects.toThrow("presentation: write");
    expect(persistence.writes).toHaveLength(0);
  });

  test("removing a placed card closes the hole it left in the dashboard", async () => {
    const service = createService({ persistence: createMemoryPersistence() });

    await expect(
      service.apply([{ type: "remove-card", cardId: "welcome" }]),
    ).resolves.toMatchObject({ cards: [], dashboard: { cards: [] } });
  });

  test("creates a theme and refuses to add one twice", async () => {
    const service = createService({ persistence: createMemoryPersistence() });

    await expect(
      service.apply([
        {
          type: "add-theme",
          theme: { id: "dark", settings: { density: "compact" } },
        },
      ]),
    ).resolves.toMatchObject({ themes: [{ id: "calm" }, { id: "dark" }] });

    await expect(
      service.apply([
        {
          type: "add-theme",
          theme: { id: "calm", settings: {} },
        },
      ]),
    ).rejects.toThrow("Duplicate theme: calm");
  });

  test("creates an integration a card can then query", async () => {
    const service = createService({ persistence: createMemoryPersistence() });

    await expect(
      service.apply([
        {
          type: "add-integration",
          integration: {
            id: "calendar",
            type: "google-calendar",
            settings: { calendarId: "team" },
          },
        },
      ]),
    ).resolves.toMatchObject({ integrations: [{ id: "calendar" }] });
  });

  test("edit mutations refuse to create what they cannot find", async () => {
    const service = createService({ persistence: createMemoryPersistence() });

    await expect(
      service.apply([
        {
          type: "edit-theme",
          theme: { id: "missing", settings: {} },
        },
      ]),
    ).rejects.toThrow("Unknown theme: missing");
  });

  test("refuses to remove a theme a dashboard still names", async () => {
    const service = createService({ persistence: createMemoryPersistence() });

    await expect(
      service.apply([{ type: "remove-theme", themeId: "calm" }]),
    ).rejects.toThrow("because dashboard 'home' uses it");
  });
});
