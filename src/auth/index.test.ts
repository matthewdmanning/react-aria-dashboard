import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { createFileAuthStore } from "./index";

describe("auth store", () => {
  test("resolves accounts without reading dashboard data", async () => {
    const directory = await mkdtemp(join(tmpdir(), "auth-store-"));
    const path = join(directory, "accounts.json");
    await writeFile(
      path,
      JSON.stringify([
        { credential: "credential", role: "reader" },
        { credential: "other", role: "local" },
      ]),
    );

    const store = createFileAuthStore(path);

    await expect(store.resolve("credential")).resolves.toEqual({
      credential: "credential",
      role: "reader",
    });
    await expect(store.resolve("missing")).resolves.toBeUndefined();
  });

  test("treats a missing auth store as having no accounts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "auth-store-"));
    const store = createFileAuthStore(join(directory, "accounts.json"));

    await expect(store.resolve("credential")).resolves.toBeUndefined();
  });

  test("rejects ambiguous credentials", async () => {
    const directory = await mkdtemp(join(tmpdir(), "auth-store-"));
    const path = join(directory, "accounts.json");
    await writeFile(
      path,
      JSON.stringify([
        { credential: "credential", role: "reader" },
        { credential: "credential", role: "local" },
      ]),
    );

    await expect(
      createFileAuthStore(path).resolve("credential"),
    ).rejects.toThrow("duplicate credential");
  });
});
