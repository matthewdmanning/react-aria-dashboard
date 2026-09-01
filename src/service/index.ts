import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  defaultDashboardConfiguration,
  mutationsSchema,
  parseDashboardConfiguration,
  type Card,
  type Dashboard,
  type DashboardConfiguration,
  type Integration,
  type Mutation,
  type PermissionCategory,
  type PermissionLevel,
  type Role,
  type Theme,
} from "../contract";

export interface DashboardPersistence {
  read(): Promise<unknown>;
  write(configuration: DashboardConfiguration): Promise<void>;
}

export interface Account {
  role: string;
}

export type AccountResolver = (
  credential: string,
) => Account | undefined | Promise<Account | undefined>;

/** What `read` returns for each scope. `all` omits categories the role cannot read. */
export interface ReadScopes {
  all: Partial<DashboardConfiguration>;
  data: { id: string; state: unknown }[];
  cards: Card[];
  presentation: {
    dashboards: Dashboard[];
    themes: Theme[];
    fontScale: number;
  };
  integrations: Integration[];
  roles: Role[];
}

export type ReadScope = keyof ReadScopes;

interface Dependencies {
  persistence: DashboardPersistence;
  resolveAccount?: AccountResolver;
}

export interface DashboardService {
  read<Scope extends ReadScope>(
    scope: Scope,
    credential?: string,
  ): Promise<ReadScopes[Scope]>;
  apply(
    mutations: readonly Mutation[],
    credential?: string,
  ): Promise<DashboardConfiguration>;
}

export function createService(dependencies: Dependencies): DashboardService {
  let tail = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(
      () => operation(),
      () => operation(),
    );
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return {
    read: (scope, credential) =>
      enqueue(() => readState(dependencies, scope, credential)),
    apply: (mutations, credential) =>
      enqueue(() => applyMutations(dependencies, mutations, credential)),
  };
}

export function createFilePersistence(path: string): DashboardPersistence {
  return {
    async read() {
      try {
        return JSON.parse(await readFile(path, "utf8")) as unknown;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return structuredClone(defaultDashboardConfiguration);
      }
    },
    async write(configuration) {
      const temporaryPath = `${path}.tmp`;
      await mkdir(dirname(path), { recursive: true });
      try {
        await writeFile(
          temporaryPath,
          `${JSON.stringify(configuration, null, 2)}\n`,
        );
        await rename(temporaryPath, path);
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
    },
  };
}

async function readConfiguration(
  persistence: DashboardPersistence,
): Promise<DashboardConfiguration> {
  return parseDashboardConfiguration(await persistence.read());
}

async function resolveRole(
  dependencies: Dependencies,
  configuration: DashboardConfiguration,
  credential: string | undefined,
): Promise<Role> {
  let account: Account | undefined = { role: "local" };

  if (credential !== undefined) {
    if (!dependencies.resolveAccount) {
      throw new Error("Authentication is not configured");
    }
    account = await dependencies.resolveAccount(credential);
    if (!account) throw new Error("Unknown credential");
  }

  const role = configuration.roles.find(({ name }) => name === account.role);
  if (!role) throw new Error(`Unknown role: ${account.role}`);
  return role;
}

async function readState<Scope extends ReadScope>(
  dependencies: Dependencies,
  scope: Scope,
  credential: string | undefined,
): Promise<ReadScopes[Scope]> {
  const configuration = await readConfiguration(dependencies.persistence);
  const role = await resolveRole(dependencies, configuration, credential);

  if (scope !== "all") requireRead(role, scope);

  const scoped: ReadScopes = {
    all: projectReadable(configuration, role),
    data: configuration.cards.map(({ id, state }) => ({ id, state })),
    cards: configuration.cards,
    presentation: {
      dashboards: configuration.dashboards,
      themes: configuration.themes,
      fontScale: configuration.fontScale,
    },
    integrations: configuration.integrations,
    roles: configuration.roles,
  };

  return scoped[scope];
}

/**
 * `all` returns the categories the role may read rather than demanding every
 * category, so the shipped `local` role — write on everything except `roles` —
 * can still load a whole dashboard.
 */
function projectReadable(
  configuration: DashboardConfiguration,
  role: Role,
): Partial<DashboardConfiguration> {
  const readable: Partial<DashboardConfiguration> = {};

  // ponytail: `data` adds nothing past `cards`; split them if a role ever needs
  // card state without the cards themselves.
  if (role.permissions.cards !== "none" || role.permissions.data !== "none") {
    readable.cards = configuration.cards;
  }
  if (role.permissions.presentation !== "none") {
    readable.dashboards = configuration.dashboards;
    readable.themes = configuration.themes;
    readable.fontScale = configuration.fontScale;
  }
  if (role.permissions.integrations !== "none") {
    readable.integrations = configuration.integrations;
  }
  if (role.permissions.roles !== "none") readable.roles = configuration.roles;

  if (Object.keys(readable).length === 0) {
    throw new Error("Permission denied: read");
  }
  return readable;
}

async function applyMutations(
  dependencies: Dependencies,
  input: readonly Mutation[],
  credential: string | undefined,
): Promise<DashboardConfiguration> {
  const mutations = mutationsSchema.parse(input);
  const configuration = await readConfiguration(dependencies.persistence);
  const role = await resolveRole(dependencies, configuration, credential);

  for (const mutation of mutations) {
    requireLevel(role, mutation.permission, requiredLevel(mutation));

    // Removing a placed card rewrites the dashboards holding it, which is a
    // presentation write however it was reached.
    if (
      mutation.type === "remove-card" &&
      configuration.dashboards.some(({ cards }) =>
        cards.includes(mutation.cardId),
      )
    ) {
      requireLevel(role, "presentation", "write");
    }
  }

  const candidate = structuredClone(configuration);
  for (const mutation of mutations) applyMutation(candidate, mutation);
  const next = parseDashboardConfiguration(candidate);
  await dependencies.persistence.write(next);
  return next;
}

function requireRead(role: Role, category: PermissionCategory): void {
  if (role.permissions[category] === "none") {
    throw new Error(`Permission denied: ${category}: read`);
  }
}

const permissionRank: Record<PermissionLevel, number> = {
  none: 0,
  read: 1,
  edit: 2,
  write: 3,
};

function requireLevel(
  role: Role,
  category: PermissionCategory,
  level: PermissionLevel,
): void {
  if (permissionRank[role.permissions[category]] < permissionRank[level]) {
    throw new Error(`Permission denied: ${category}: ${level}`);
  }
}

/**
 * `edit` changes something that already exists; `write` also creates and
 * destroys. Every mutation not listed here needs `write`.
 */
const editLevelMutations = new Set<Mutation["type"]>([
  "patch-card-state",
  "edit-card",
  "edit-dashboard",
  "edit-theme",
  "edit-integration",
  "set-font-scale",
  "insert-card",
]);

function requiredLevel(mutation: Mutation): PermissionLevel {
  return editLevelMutations.has(mutation.type) ? "edit" : "write";
}

function applyMutation(
  configuration: DashboardConfiguration,
  mutation: Mutation,
): void {
  switch (mutation.type) {
    case "patch-card-state": {
      const card = requireById(configuration.cards, mutation.cardId, "card");
      // ponytail: shallow object patch; add JSON Merge Patch if nested updates are needed.
      card.state =
        isRecord(card.state) && isRecord(mutation.patch)
          ? { ...card.state, ...mutation.patch }
          : mutation.patch;
      return;
    }
    case "add-card":
      addById(configuration.cards, mutation.card, "card");
      return;
    case "edit-card":
      replaceById(configuration.cards, mutation.card, "card");
      return;
    case "remove-card":
      configuration.cards = removeById(
        configuration.cards,
        mutation.cardId,
        "card",
      );
      for (const dashboard of configuration.dashboards) {
        dashboard.cards = dashboard.cards.filter(
          (id) => id !== mutation.cardId,
        );
      }
      return;
    case "insert-card": {
      const dashboard = requireById(
        configuration.dashboards,
        mutation.dashboardId,
        "dashboard",
      );
      requireById(configuration.cards, mutation.cardId, "card");
      if (dashboard.cards.includes(mutation.cardId)) {
        throw new Error(
          `Dashboard '${mutation.dashboardId}' already contains card '${mutation.cardId}'`,
        );
      }
      dashboard.cards.splice(
        mutation.index ?? dashboard.cards.length,
        0,
        mutation.cardId,
      );
      return;
    }
    case "edit-dashboard":
      replaceById(configuration.dashboards, mutation.dashboard, "dashboard");
      return;
    case "add-theme":
      addById(configuration.themes, mutation.theme, "theme");
      return;
    case "edit-theme":
      replaceById(configuration.themes, mutation.theme, "theme");
      return;
    case "remove-theme": {
      const dashboard = configuration.dashboards.find(
        ({ theme }) => theme === mutation.themeId,
      );
      if (dashboard) {
        throw new Error(
          `Cannot remove theme '${mutation.themeId}' because dashboard '${dashboard.id}' uses it`,
        );
      }
      configuration.themes = removeById(
        configuration.themes,
        mutation.themeId,
        "theme",
      );
      return;
    }
    case "set-font-scale":
      configuration.fontScale = mutation.fontScale;
      return;
    case "add-integration":
      addById(configuration.integrations, mutation.integration, "integration");
      return;
    case "edit-integration":
      replaceById(
        configuration.integrations,
        mutation.integration,
        "integration",
      );
      return;
    case "remove-integration": {
      const card = configuration.cards.find(({ queries }) =>
        queries.some(
          ({ integration }) => integration === mutation.integrationId,
        ),
      );
      if (card) {
        throw new Error(
          `Cannot remove integration '${mutation.integrationId}' because card '${card.id}' uses it`,
        );
      }
      configuration.integrations = removeById(
        configuration.integrations,
        mutation.integrationId,
        "integration",
      );
      return;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireById<T extends { id: string }>(
  values: T[],
  id: string,
  label: string,
): T {
  const value = values.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Unknown ${label}: ${id}`);
  return value;
}

function addById<T extends { id: string }>(
  values: T[],
  addition: T,
  label: string,
): void {
  if (values.some(({ id }) => id === addition.id)) {
    throw new Error(`Duplicate ${label}: ${addition.id}`);
  }
  values.push(addition);
}

function replaceById<T extends { id: string }>(
  values: T[],
  replacement: T,
  label: string,
): void {
  const index = values.findIndex(({ id }) => id === replacement.id);
  if (index === -1) throw new Error(`Unknown ${label}: ${replacement.id}`);
  values[index] = replacement;
}

function removeById<T extends { id: string }>(
  values: T[],
  id: string,
  label: string,
): T[] {
  const remaining = values.filter((value) => value.id !== id);
  if (remaining.length === values.length) {
    throw new Error(`Unknown ${label}: ${id}`);
  }
  return remaining;
}
