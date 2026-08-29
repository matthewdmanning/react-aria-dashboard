import * as z from "zod/v4";

export const cardVariantSchemas = {
  message: z
    .object({
      message: z.string(),
    })
    .strict(),
  table: z
    .object({
      columns: z.array(
        z
          .object({
            key: z.string(),
            label: z.string(),
          })
          .strict(),
      ),
      rows: z.array(
        z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
      ),
    })
    .strict(),
  list: z
    .object({
      items: z.array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            body: z.string().optional(),
          })
          .strict(),
      ),
    })
    .strict(),
  calendar: z
    .object({
      events: z.array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            start: z.string(),
            end: z.string().optional(),
          })
          .strict(),
      ),
    })
    .strict(),
  chart: z
    .object({
      title: z.string(),
      summary: z.string(),
      series: z.array(
        z
          .object({
            label: z.string(),
            value: z.number(),
          })
          .strict(),
      ),
    })
    .strict(),
};

export type CardVariant = keyof typeof cardVariantSchemas;
