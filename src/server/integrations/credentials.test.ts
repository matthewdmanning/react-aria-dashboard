import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { createFileCredentialStore } from "./credentials";

describe("file credential store", () => {
  test("a connection with no stored credential resolves to undefined", async () => {
    const directory = await mkdtemp(join(tmpdir(), "credentials-"));
    const store = createFileCredentialStore(join(directory, "credentials.json"));

    await expect(store.get("team-calendar")).resolves.toBeUndefined();
  });

  test("set, get, and remove round-trip, keyed by connection id", async () => {
    const directory = await mkdtemp(join(tmpdir(), "credentials-"));
    const path = join(directory, "credentials.json");
    const store = createFileCredentialStore(path);

    await store.set("team-calendar", "secret-token");
    await store.set("backup-target", "other-secret");

    await expect(store.get("team-calendar")).resolves.toBe("secret-token");
    await expect(store.get("backup-target")).resolves.toBe("other-secret");

    await store.remove("team-calendar");
    await expect(store.get("team-calendar")).resolves.toBeUndefined();
    await expect(store.get("backup-target")).resolves.toBe("other-secret");

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      "backup-target": "other-secret",
    });
  });
});
