import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import type { AuthStore } from "../auth";
import type { CredentialStore } from "../server/integrations/credentials";
import { generateComponentSource } from "../card-templates/codegen";
import {
  defaultDashboardConfiguration,
  mutationRequirements,
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

/**
 * Why a service call failed, named in the service's own terms. Adapters map a
 * code to their vocabulary — a status, a tool result, a message — so no caller
 * has to match on the message text.
 */
export type ServiceFailureCode =
  | "unknown-credential"
  | "authentication-unavailable"
  | "permission-denied"
  | "unknown-role"
  | "unknown-id"
  | "duplicate-id"
  | "in-use"
  | "credentials-unavailable"
  | "invalid-composition"
  | "not-implemented";

export class ServiceFailure extends Error {
  constructor(
    readonly code: ServiceFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceFailure";
  }
}

export interface DashboardPersistence {
  read(): Promise<unknown>;
  write(configuration: DashboardConfiguration): Promise<void>;
}

/** What `read` returns for each scope. `all` omits categories the role cannot read. */
export interface ReadScopes {
  all: Partial<DashboardConfiguration>;
  /** The caller's own resolved role. Never gated — a caller may always see what it may do. */
  role: Role;
  data: { id: string; state: unknown }[];
  cards: Card[];
  presentation: {
    dashboard: Dashboard;
    themes: Theme[];
    fontScale: number;
  };
  integrations: Integration[];
  roles: Role[];
}

export type ReadScope = keyof ReadScopes;

interface Dependencies {
  persistence: DashboardPersistence;
  authStore?: AuthStore;
  /** Where an integration's authorization secret lives — see `CredentialStore` (D16). */
  credentials?: CredentialStore;
  /** The service types this build can pull from — how a caller learns what may be connected. */
  connectableTypes?: readonly string[];
}

export interface DashboardService {
  read<Scope extends ReadScope>(
    scope: Scope,
    credential?: string,
  ): Promise<ReadScopes[Scope]>;
  /**
   * Returns the same projection `read("all")` would — the categories the
   * caller may read, denied ones omitted — never the full configuration
   * regardless of what changed.
   */
  apply(
    mutations: readonly Mutation[],
    credential?: string,
  ): Promise<ReadScopes["all"]>;
  /**
   * The authorization handoff for one connection (D16): stores its secret
   * outside dashboard configuration. Not a mutation — a credential never
   * enters `DashboardConfiguration` or a read projection (`contract`
   * already refuses a credential-shaped `integration.settings` key; this
   * keeps the same promise for the store `apply` never touches). Gated at
   * `integrations: edit` — the connection already exists via
   * `add-integration`; authorizing it changes something that exists (D20).
   */
  authorize(
    connectionId: string,
    connectionCredential: string,
    credential?: string,
  ): Promise<void>;
  /** The services this build can connect to. Gated at `integrations: read`. */
  connectableTypes(credential?: string): Promise<string[]>;
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
    authorize: (connectionId, connectionCredential, credential) =>
      enqueue(() =>
        authorizeConnection(
          dependencies,
          connectionId,
          connectionCredential,
          credential,
        ),
      ),
    connectableTypes: (credential) =>
      enqueue(() => readConnectableTypes(dependencies, credential)),
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
  let roleName = "local";

  if (credential !== undefined) {
    if (!dependencies.authStore) {
      throw new ServiceFailure(
        "authentication-unavailable",
        "Authentication is not configured",
      );
    }
    const account = await dependencies.authStore.resolve(credential);
    if (!account) {
      throw new ServiceFailure("unknown-credential", "Unknown credential");
    }
    roleName = account.role;
  }

  const role = configuration.roles.find(({ name }) => name === roleName);
  if (!role) {
    throw new ServiceFailure("unknown-role", `Unknown role: ${roleName}`);
  }
  return role;
}

async function readState<Scope extends ReadScope>(
  dependencies: Dependencies,
  scope: Scope,
  credential: string | undefined,
): Promise<ReadScopes[Scope]> {
  const configuration = await readConfiguration(dependencies.persistence);
  const role = await resolveRole(dependencies, configuration, credential);

  if (scope !== "all" && scope !== "role") requireRead(role, scope);

  // Built per scope, not all at once: `all` refuses a role that may read
  // nothing, which must not decide the answer for a scope nobody asked for.
  const scoped: { [Scope in ReadScope]: () => ReadScopes[Scope] } = {
    all: () => projectReadable(configuration, role),
    role: () => role,
    data: () => configuration.cards.map(({ id, state }) => ({ id, state })),
    cards: () => configuration.cards,
    presentation: () => ({
      dashboard: configuration.dashboard,
      themes: configuration.themes,
      fontScale: configuration.fontScale,
    }),
    integrations: () => configuration.integrations,
    roles: () => configuration.roles,
  };

  return scoped[scope]();
}

/**
 * `all` returns the categories the role may read rather than demanding every
 * category, so the shipped `local` role — write on everything except `roles` —
 * can still load a whole dashboard.
 *
 * `apply` projects its result the same way (`allowEmpty: true`): a role that
 * may change something it cannot read — `data: edit`, `read` otherwise
 * `none` everywhere — must not be handed a `permission-denied` for a
 * mutation that just succeeded. An empty projection is the honest answer:
 * it changed something, and may read nothing back.
 */
function projectReadable(
  configuration: DashboardConfiguration,
  role: Role,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): Partial<DashboardConfiguration> {
  const readable: Partial<DashboardConfiguration> = {};

  // ponytail: `data` adds nothing past `cards`; split them if a role ever needs
  // card state without the cards themselves.
  if (role.permissions.cards !== "none" || role.permissions.data !== "none") {
    readable.cards = configuration.cards;
  }
  if (role.permissions.presentation !== "none") {
    readable.dashboard = configuration.dashboard;
    readable.themes = configuration.themes;
    readable.fontScale = configuration.fontScale;
  }
  if (role.permissions.integrations !== "none") {
    readable.integrations = configuration.integrations;
  }
  if (role.permissions.roles !== "none") readable.roles = configuration.roles;

  if (Object.keys(readable).length === 0 && !allowEmpty) {
    throw new ServiceFailure("permission-denied", "Permission denied: read");
  }
  return readable;
}

async function applyMutations(
  dependencies: Dependencies,
  input: readonly Mutation[],
  credential: string | undefined,
): Promise<ReadScopes["all"]> {
  const mutations = mutationsSchema.parse(input);
  const configuration = await readConfiguration(dependencies.persistence);
  const role = await resolveRole(dependencies, configuration, credential);

  for (const mutation of mutations) {
    const { category, level } = mutationRequirements[mutation.type];
    requireLevel(role, category, level);

    // Removing a placed card rewrites the dashboard holding it, which is a
    // presentation write however it was reached.
    if (
      mutation.type === "remove-card" &&
      configuration.dashboard.cards.includes(mutation.cardId)
    ) {
      requireLevel(role, "presentation", "write");
    }
  }

  // Real filesystem writes, unlike the in-memory mutations below. Every
  // composition in the batch is generated and type-checked into a temp file
  // first; only once ALL of them pass are any renamed into tracked source —
  // one invalid tree in a multi-assemble batch must not leave an earlier,
  // valid one already landed.
  const assembled: { tempPath: string; finalPath: string }[] = [];
  try {
    for (const mutation of mutations) {
      if (mutation.type === "assemble-card-template") {
        assembled.push(await checkCardTemplateSource(mutation));
      }
    }
    for (const { tempPath, finalPath } of assembled) {
      await rename(tempPath, finalPath);
    }
  } catch (error) {
    await Promise.all(
      assembled.map(({ tempPath }) => unlink(tempPath).catch(() => undefined)),
    );
    throw error;
  }

  const candidate = structuredClone(configuration);
  for (const mutation of mutations) applyMutation(candidate, mutation);
  const next = parseDashboardConfiguration(candidate);
  await dependencies.persistence.write(next);

  // Revoking an integration's authorization rides along with removing it
  // (D16) — there is no "disconnect without removing" action to hang a
  // separate revoke on, and it fires here so every caller of `apply` gets
  // it, not just the ones that happen to go through one adapter.
  //
  // ponytail: after the write, so a failed revoke orphans the secret of an
  // integration that is already gone. Re-authorizing then removing it again
  // clears it. Make the pair atomic if a credential store ever fails often
  // enough to matter.
  if (dependencies.credentials) {
    const removed = mutations.filter(
      (
        mutation,
      ): mutation is Extract<Mutation, { type: "remove-integration" }> =>
        mutation.type === "remove-integration",
    );
    await Promise.all(
      removed.map((mutation) =>
        dependencies.credentials!.remove(mutation.integrationId),
      ),
    );
  }

  return projectReadable(next, role, { allowEmpty: true });
}

async function authorizeConnection(
  dependencies: Dependencies,
  connectionId: string,
  connectionCredential: string,
  credential: string | undefined,
): Promise<void> {
  const configuration = await readConfiguration(dependencies.persistence);
  const role = await resolveRole(dependencies, configuration, credential);
  requireLevel(role, "integrations", "edit");

  if (!configuration.integrations.some(({ id }) => id === connectionId)) {
    throw new ServiceFailure(
      "unknown-id",
      `Unknown integration: ${connectionId}`,
    );
  }

  if (!dependencies.credentials) {
    throw new ServiceFailure(
      "credentials-unavailable",
      "Credential storage is not configured",
    );
  }
  await dependencies.credentials.set(connectionId, connectionCredential);
}

async function readConnectableTypes(
  dependencies: Dependencies,
  credential: string | undefined,
): Promise<string[]> {
  const configuration = await readConfiguration(dependencies.persistence);
  const role = await resolveRole(dependencies, configuration, credential);
  requireRead(role, "integrations");
  return [...(dependencies.connectableTypes ?? [])];
}

function requireRead(role: Role, category: PermissionCategory): void {
  if (role.permissions[category] === "none") {
    throw new ServiceFailure(
      "permission-denied",
      `Permission denied: ${category}: read`,
    );
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
    throw new ServiceFailure(
      "permission-denied",
      `Permission denied: ${category}: ${level}`,
    );
  }
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
      configuration.dashboard.cards = configuration.dashboard.cards.filter(
        (id) => id !== mutation.cardId,
      );
      return;
    case "insert-card": {
      const { dashboard } = configuration;
      if (dashboard.id !== mutation.dashboardId) {
        throw new ServiceFailure(
          "unknown-id",
          `Unknown dashboard: ${mutation.dashboardId}`,
        );
      }
      requireById(configuration.cards, mutation.cardId, "card");
      if (dashboard.cards.includes(mutation.cardId)) {
        throw new ServiceFailure(
          "duplicate-id",
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
      if (configuration.dashboard.id !== mutation.dashboard.id) {
        throw new ServiceFailure(
          "unknown-id",
          `Unknown dashboard: ${mutation.dashboard.id}`,
        );
      }
      configuration.dashboard = mutation.dashboard;
      return;
    case "add-theme":
      addById(configuration.themes, mutation.theme, "theme");
      return;
    case "edit-theme":
      replaceById(configuration.themes, mutation.theme, "theme");
      return;
    case "remove-theme": {
      const { dashboard } = configuration;
      if (dashboard.theme === mutation.themeId) {
        throw new ServiceFailure(
          "in-use",
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
        throw new ServiceFailure(
          "in-use",
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
    case "assemble-card-template":
      // Checked and renamed into src/client/cards/ above, before this loop
      // runs — nothing left to change on the configuration itself (#76
      // registers the template's schema so cards can reference it).
      return;
  }
}

const cardTemplatesDir = join(process.cwd(), "src", "client", "cards");
const tscBin = join(process.cwd(), "node_modules", "typescript", "bin", "tsc");

function toComponentName(template: string): string {
  return template
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Type-checks one composition's generated source in isolation — a scoped
 * tsconfig (`extends` the real one, `include` overridden to just this file)
 * so one bad pre-existing file elsewhere in the tree can't fail an
 * otherwise-valid composition, and so a full project check doesn't run on
 * every assemble call.
 */
async function typeChecks(temporaryPath: string): Promise<boolean> {
  const relativePath = temporaryPath
    .slice(process.cwd().length + 1)
    .split("\\")
    .join("/");
  const scopedConfigPath = join(
    process.cwd(),
    `tsconfig.assemble.${randomUUID()}.json`,
  );
  await writeFile(
    scopedConfigPath,
    JSON.stringify({ extends: "./tsconfig.json", include: [relativePath] }),
  );
  try {
    execFileSync(process.execPath, [tscBin, "--noEmit", "-p", scopedConfigPath], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  } finally {
    await unlink(scopedConfigPath).catch(() => undefined);
  }
}

async function checkCardTemplateSource(
  mutation: Extract<Mutation, { type: "assemble-card-template" }>,
): Promise<{ tempPath: string; finalPath: string }> {
  const source = generateComponentSource(
    mutation.composition,
    toComponentName(mutation.template),
  );
  await mkdir(cardTemplatesDir, { recursive: true });
  const finalPath = join(cardTemplatesDir, `${mutation.template}.tsx`);
  // A dot-prefixed name would be silently excluded from tsc's default
  // `include` globbing, defeating the type-check this file exists for. The
  // uuid keeps concurrent assembles of the same template from colliding on
  // the same temp file.
  const temporaryPath = join(
    cardTemplatesDir,
    `__assemble-${mutation.template}-${randomUUID()}.tsx`,
  );
  await writeFile(temporaryPath, source);
  if (!(await typeChecks(temporaryPath))) {
    await unlink(temporaryPath).catch(() => undefined);
    throw new ServiceFailure(
      "invalid-composition",
      `Composition tree for template '${mutation.template}' failed to type-check`,
    );
  }
  return { tempPath: temporaryPath, finalPath };
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
  if (!value) throw new ServiceFailure("unknown-id", `Unknown ${label}: ${id}`);
  return value;
}

function addById<T extends { id: string }>(
  values: T[],
  addition: T,
  label: string,
): void {
  if (values.some(({ id }) => id === addition.id)) {
    throw new ServiceFailure(
      "duplicate-id",
      `Duplicate ${label}: ${addition.id}`,
    );
  }
  values.push(addition);
}

function replaceById<T extends { id: string }>(
  values: T[],
  replacement: T,
  label: string,
): void {
  const index = values.findIndex(({ id }) => id === replacement.id);
  if (index === -1) {
    throw new ServiceFailure(
      "unknown-id",
      `Unknown ${label}: ${replacement.id}`,
    );
  }
  values[index] = replacement;
}

function removeById<T extends { id: string }>(
  values: T[],
  id: string,
  label: string,
): T[] {
  const remaining = values.filter((value) => value.id !== id);
  if (remaining.length === values.length) {
    throw new ServiceFailure("unknown-id", `Unknown ${label}: ${id}`);
  }
  return remaining;
}
