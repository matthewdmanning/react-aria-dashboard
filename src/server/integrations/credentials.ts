import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Where an integration's authorization secret lives: outside dashboard
 * configuration (`contract` refuses a credential-shaped key in an
 * integration's `settings`) and outside the auth store (that resolves a
 * caller of this service; this resolves this dashboard's authorization to
 * call an external one). Shared by integrations and backup targets alike
 * (D16): both hand off one secret for one external connection, keyed by
 * that connection's id.
 */
export interface CredentialStore {
  get(connectionId: string): Promise<string | undefined>;
  set(connectionId: string, credential: string): Promise<void>;
  remove(connectionId: string): Promise<void>;
}

async function readAll(path: string): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, string>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {};
  }
}

async function writeAll(
  path: string,
  credentials: Record<string, string>,
): Promise<void> {
  const temporaryPath = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`);
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

/** Reads and writes on every call, so a change is visible without caching a secret in memory. */
export function createFileCredentialStore(path: string): CredentialStore {
  return {
    async get(connectionId) {
      return (await readAll(path))[connectionId];
    },
    async set(connectionId, credential) {
      const credentials = await readAll(path);
      credentials[connectionId] = credential;
      await writeAll(path, credentials);
    },
    async remove(connectionId) {
      const credentials = await readAll(path);
      delete credentials[connectionId];
      await writeAll(path, credentials);
    },
  };
}
