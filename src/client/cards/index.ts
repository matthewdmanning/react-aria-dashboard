import type { ComponentType } from "react";
import type * as z from "zod/v4";
import type { CardTemplateName } from "../../contract";

export interface CardTemplate<T> {
  schema: z.ZodType<T>;
  Component: ComponentType<{ data: T }>;
}

/**
 * The card templates this dashboard has wired in — the map that decides which
 * templates are real, read by `CardView` to render one and by the registry
 * endpoint to serve them (D24).
 *
 * Empty: the original five were deleted in D32 and their shadcn replacements
 * are not written yet. A running dashboard therefore serves an empty registry
 * and renders no card.
 */
export const includedCardTemplates: Record<
  CardTemplateName,
  CardTemplate<unknown>
> = {};

/**
 * Which source file each template's export lives in — several templates can
 * share one file, so the registry endpoint (src/server/registry.ts) reads this
 * rather than guessing `<name>.tsx`. Kept beside `includedCardTemplates` so the
 * two cannot drift.
 */
export const cardTemplateSourceFiles: Record<CardTemplateName, string> = {};
