import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface DraftMeta {
  title: string;
  sources: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function panelDir(workspace: string, id: string): string {
  return join(workspace, "panels", id);
}

export function draftDir(workspace: string, id: string): string {
  return join(workspace, ".dashboard", "drafts", id);
}

export async function panelExists(
  workspace: string,
  id: string,
): Promise<boolean> {
  return exists(join(panelDir(workspace, id), "panel.json"));
}

export async function draftExists(
  workspace: string,
  id: string,
): Promise<boolean> {
  return exists(join(draftDir(workspace, id), "meta.json"));
}

export async function draftHasFile(
  workspace: string,
  id: string,
  filename: string,
): Promise<boolean> {
  return exists(join(draftDir(workspace, id), filename));
}

export async function readDraftMeta(
  workspace: string,
  id: string,
): Promise<DraftMeta | undefined> {
  try {
    return JSON.parse(
      await readFile(join(draftDir(workspace, id), "meta.json"), "utf8"),
    ) as DraftMeta;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeDraftMeta(
  workspace: string,
  id: string,
  meta: DraftMeta,
): Promise<void> {
  await mkdir(draftDir(workspace, id), { recursive: true });
  await writeFile(
    join(draftDir(workspace, id), "meta.json"),
    JSON.stringify(meta),
  );
}

export async function writeDraftFile(
  workspace: string,
  id: string,
  filename: string,
  content: string,
): Promise<void> {
  await mkdir(draftDir(workspace, id), { recursive: true });
  await writeFile(join(draftDir(workspace, id), filename), content);
}

export async function readDraftFile(
  workspace: string,
  id: string,
  filename: string,
): Promise<string> {
  return readFile(join(draftDir(workspace, id), filename), "utf8");
}

/**
 * Seeds a fresh draft directory from the panel's live files, so an edit
 * session that only re-runs one draft step keeps the rest of the panel
 * unchanged at commit time. No-op if the draft already exists, or the
 * panel is new.
 */
export async function seedDraftFromLivePanel(
  workspace: string,
  id: string,
): Promise<void> {
  if (await draftExists(workspace, id)) return;
  if (!(await panelExists(workspace, id))) return;

  const live = panelDir(workspace, id);
  const manifest = JSON.parse(
    await readFile(join(live, "panel.json"), "utf8"),
  ) as { title: string; sources: string[]; formatter?: string };

  await mkdir(draftDir(workspace, id), { recursive: true });
  await writeDraftMeta(workspace, id, {
    title: manifest.title,
    sources: manifest.sources,
  });
  await writeFile(
    join(draftDir(workspace, id), "schema.json"),
    await readFile(join(live, "schema.json"), "utf8"),
  );
  await writeFile(
    join(draftDir(workspace, id), "panel.tsx"),
    await readFile(join(live, "panel.tsx"), "utf8"),
  );
  if (manifest.formatter) {
    await writeFile(
      join(draftDir(workspace, id), "formatter.ts"),
      await readFile(join(live, "formatter.ts"), "utf8"),
    );
  }
}

export async function removeDraft(
  workspace: string,
  id: string,
): Promise<void> {
  await rm(draftDir(workspace, id), { recursive: true, force: true });
}
