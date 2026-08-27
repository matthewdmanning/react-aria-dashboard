import { readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import * as z from "zod/v4";

const panelPackageManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1),
    schema: z.string().regex(/\.json$/),
    component: z.string().regex(/\.(tsx|ts|jsx|js)$/),
    formatter: z
      .string()
      .regex(/\.(tsx|ts|jsx|js)$/)
      .optional(),
    sources: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type PanelPackageManifest = z.infer<typeof panelPackageManifestSchema>;

export interface PanelPackage {
  manifest: PanelPackageManifest;
  schema: Record<string, unknown>;
  root: string;
}

const forbiddenSource =
  /(?:import\s+.*from\s+|require\s*\()?["'](?:node:)?(?:child_process|fs|net|http|https|os|process)["']/;

function packagePath(root: string, relativePath: string) {
  const target = resolve(root, relativePath);
  const scoped = relative(resolve(root), target);
  if (!scoped || scoped.startsWith("..") || relativePath.includes("\\")) {
    throw new Error("Panel package paths must stay inside the package");
  }
  return target;
}

export async function readPanelPackage(
  workspacePath: string,
  packageId: string,
): Promise<PanelPackage> {
  const root = resolve(workspacePath, "panels", packageId);
  const manifest = panelPackageManifestSchema.parse(
    JSON.parse(await readFile(join(root, "panel.json"), "utf8")),
  );
  if (manifest.id !== packageId) {
    throw new Error("Panel package id does not match its directory");
  }
  const schema = JSON.parse(
    await readFile(packagePath(root, manifest.schema), "utf8"),
  ) as Record<string, unknown>;
  const componentSource = await readFile(
    packagePath(root, manifest.component),
    "utf8",
  );
  if (forbiddenSource.test(componentSource)) {
    throw new Error("Panel component uses a forbidden API");
  }
  if (manifest.formatter) {
    const formatterSource = await readFile(
      packagePath(root, manifest.formatter),
      "utf8",
    );
    if (forbiddenSource.test(formatterSource)) {
      throw new Error("Panel formatter uses a forbidden API");
    }
  }
  return { manifest, schema, root };
}

export function validatePanelPackageManifest(candidate: unknown) {
  const manifest = panelPackageManifestSchema.parse(candidate);
  const references = [
    manifest.schema,
    manifest.component,
    manifest.formatter,
  ].filter((reference): reference is string => reference !== undefined);
  if (
    extname(manifest.schema) !== ".json" ||
    references.some(
      (reference) => reference.includes("..") || reference.includes("\\"),
    )
  ) {
    throw new Error("Panel schema must be JSON");
  }
  return manifest;
}
