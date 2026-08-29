import type { JsonSchema } from "./index";

export const cardVariantSchemas = {
  message: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
    additionalProperties: false,
  },
  table: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: { key: { type: "string" }, label: { type: "string" } },
          required: ["key", "label"],
          additionalProperties: false,
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
          },
        },
      },
    },
    required: ["columns", "rows"],
    additionalProperties: false,
  },
  list: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
          },
          required: ["id", "title"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  calendar: {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
          },
          required: ["id", "title", "start"],
          additionalProperties: false,
        },
      },
    },
    required: ["events"],
    additionalProperties: false,
  },
  chart: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      series: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, value: { type: "number" } },
          required: ["label", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "summary", "series"],
    additionalProperties: false,
  },
} satisfies Record<string, JsonSchema>;

export type CardVariant = keyof typeof cardVariantSchemas;
