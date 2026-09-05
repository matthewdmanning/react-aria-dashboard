import type * as z from "zod/v4";

/**
 * Each card template's schema, by template name — one half of a card template,
 * the other being its component in `card-templates` (D22).
 *
 * Empty. The original five (`message`, `table`, `list`, `calendar`, `chart`)
 * were deleted in D32: they rendered raw HTML with no styling, predated every
 * decision from D25 onward, and were not a base to build shadcn templates on.
 * Templates are added back here as they are written, each paired with its
 * component.
 */
export const cardTemplateSchemas: Record<string, z.ZodType<unknown>> = {};

export type CardTemplateName = string;
