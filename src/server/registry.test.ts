import { describe, expect, test } from "vitest";

import { cardTemplateSourceFiles, includedCardTemplates } from "../client/cards";
import { handleRegistryRequest } from "./registry";
import {
  useTestCardTemplates,
  withTestCard,
} from "../test-support/card-template";

describe("dashboard registry", () => {
  useTestCardTemplates();

  test("index lists every included card template, no file content", async () => {
    const response = await handleRegistryRequest(
      new Request("http://dashboard/r/registry.json"),
    );
    const body = await response.json();

    expect(body.$schema).toBe("https://ui.shadcn.com/schema/registry.json");
    expect(body.items.map((item: { name: string }) => item.name).sort()).toEqual(
      Object.keys(includedCardTemplates).sort(),
    );
    for (const item of body.items) {
      expect(item.files[0].content).toBeUndefined();
    }
  });

  test("item endpoint serves the template's real source file, with content", async () => {
    const response = await handleRegistryRequest(
      new Request("http://dashboard/r/message.json"),
    );
    const body = await response.json();

    expect(body.name).toBe("message");
    expect(body.type).toBe("registry:block");
    expect(body.files[0].path).toBe(
      `src/client/cards/${cardTemplateSourceFiles.message}`,
    );
    expect(body.files[0].content).toContain("CardView");
  });

  test("unknown item name 404s", async () => {
    const response = await handleRegistryRequest(
      new Request("http://dashboard/r/not-a-template.json"),
    );
    expect(response.status).toBe(404);
  });

  test("a template sharing a file with others still resolves its own item", async () => {
    const response = await handleRegistryRequest(
      new Request("http://dashboard/r/chart.json"),
    );
    const body = await response.json();

    expect(body.name).toBe("chart");
    expect(body.files[0].path).toBe(
      `src/client/cards/${cardTemplateSourceFiles.chart}`,
    );
  });
});
