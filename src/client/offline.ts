import {
  defaultDashboardConfiguration,
  mutationRequirements,
  type Mutation,
  type ReadableDashboard,
} from "../contract";
import { RequestFailure } from "./request";

/** The subset of `Storage` the cache and queue need, so a test can fake it. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// ponytail: keyed by the one dashboard this build ships (D21) rather than a
// runtime id — there is nothing else it could be. Revisit if a second
// dashboard is ever possible.
const CACHE_KEY = `dashboard-cache:${defaultDashboardConfiguration.dashboard.id}`;
const QUEUE_KEY = `dashboard-mutation-queue:${defaultDashboardConfiguration.dashboard.id}`;

function readJSON<T>(store: KeyValueStore, key: string): T | undefined {
  const raw = store.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/**
 * The last dashboard a live `read("all")` returned, overwritten on every
 * successful read. No expiry, no eviction.
 *
 * ponytail: `localStorage`'s per-origin quota (a few MB) is the ceiling —
 * move to IndexedDB if a cached dashboard ever approaches it.
 */
export function readCachedDashboard(
  store: KeyValueStore,
): ReadableDashboard | undefined {
  return readJSON(store, CACHE_KEY);
}

export function writeCachedDashboard(
  store: KeyValueStore,
  dashboard: ReadableDashboard,
): void {
  store.setItem(CACHE_KEY, JSON.stringify(dashboard));
}

function readQueue(store: KeyValueStore): Mutation[][] {
  return readJSON(store, QUEUE_KEY) ?? [];
}

function writeQueue(store: KeyValueStore, queue: Mutation[][]): void {
  store.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function pendingMutationCount(store: KeyValueStore): number {
  return readQueue(store).reduce((count, group) => count + group.length, 0);
}

/** `integrations` mutations require a live service (D15) and are never queued. */
export function requiresLiveService(mutations: readonly Mutation[]): boolean {
  return mutations.some(
    (mutation) =>
      mutationRequirements[mutation.type].category === "integrations",
  );
}

/** Adds one `apply` call's mutations to the queue, as the group it was submitted in. */
export function enqueue(
  store: KeyValueStore,
  mutations: readonly Mutation[],
): void {
  writeQueue(store, [...readQueue(store), [...mutations]]);
}

function isPermanentFailure(error: unknown): error is RequestFailure {
  return (
    error instanceof RequestFailure &&
    (error.code === "permission-denied" || error.code === "unknown-id")
  );
}

/**
 * Replays the queue against the service, oldest group first, each group
 * applying atomically — the same guarantee `apply` gave when it was queued
 * (D14). A group the service will never accept no matter how many times it
 * is retried (a permission denial, or an id that no longer exists) is
 * dropped and reported. Any other failure — a transport problem, most
 * likely — stops the replay, leaving that group and everything after it
 * queued for the next attempt.
 */
export async function replayQueue(
  store: KeyValueStore,
  apply: (mutations: readonly Mutation[]) => Promise<unknown>,
): Promise<{ dropped: RequestFailure[] }> {
  const queue = readQueue(store);
  const dropped: RequestFailure[] = [];
  let index = 0;

  while (index < queue.length) {
    try {
      await apply(queue[index]);
      index++;
    } catch (error) {
      if (isPermanentFailure(error)) {
        dropped.push(error);
        index++;
        continue;
      }
      break;
    }
  }

  writeQueue(store, queue.slice(index));
  return { dropped };
}
