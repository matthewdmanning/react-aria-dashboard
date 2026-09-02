import { readFile } from "node:fs/promises";
import * as z from "zod/v4";

const accountSchema = z
  .object({
    credential: z.string().min(1),
    role: z.string().min(1),
  })
  .strict();

const accountsSchema = z.array(accountSchema);

export type Account = z.infer<typeof accountSchema>;

export interface AuthStore {
  resolve(credential: string): Promise<Account | undefined>;
}

/**
 * Reads accounts on every lookup so the service sees store changes without
 * keeping credentials or role assignments in dashboard data.
 */
export function createFileAuthStore(path: string): AuthStore {
  return {
    async resolve(credential) {
      let accounts: Account[];
      try {
        accounts = accountsSchema.parse(
          JSON.parse(await readFile(path, "utf8")),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return undefined;
        }
        throw error;
      }

      if (
        new Set(accounts.map(({ credential: value }) => value)).size !==
        accounts.length
      ) {
        throw new Error("Invalid auth store: duplicate credential");
      }

      // ponytail: plaintext credential, non-constant-time compare. Fine while
      // the only door is a local stdio caller; hash the stored credential and
      // compare with timingSafeEqual before a network door reaches this.
      return accounts.find((account) => account.credential === credential);
    },
  };
}
