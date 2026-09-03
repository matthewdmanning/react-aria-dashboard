import { describe, expect, it } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { CompositionNode } from "../contract";
import { generateComponentSource } from "./codegen";

describe("generateComponentSource", () => {
  it("renders a leaf node with no children", () => {
    const tree: CompositionNode = {
      component: "Text",
      props: {},
      children: [],
    };
    expect(generateComponentSource(tree)).toMatchInlineSnapshot(`
      "import { Text } from "react-aria-components";

      export function GeneratedCardTemplate() {
        return (
          <Text />
        );
      }
      "
    `);
  });

  it("renders nested children and string/number/boolean props", () => {
    const tree: CompositionNode = {
      component: "GridList",
      props: { "aria-label": "Do" },
      children: [
        {
          component: "GridListItem",
          props: { textValue: "Fix outage", index: 1, disabled: false },
          children: [{ component: "Text", props: {}, children: [] }],
        },
      ],
    };
    const source = generateComponentSource(tree, "MyTemplate");
    expect(source).toContain(
      'import { GridList, GridListItem, Text } from "react-aria-components";',
    );
    expect(source).toContain('export function MyTemplate()');
    expect(source).toContain('<GridList aria-label="Do">');
    expect(source).toContain(
      '<GridListItem disabled={false} index={1} textValue="Fix outage">',
    );
    expect(source).toContain("<Text />");
    expect(source).toContain("</GridListItem>");
    expect(source).toContain("</GridList>");
  });

  it("is deterministic — same tree, same output", () => {
    const tree: CompositionNode = {
      component: "Button",
      props: { isDisabled: true },
      children: [],
    };
    expect(generateComponentSource(tree)).toBe(generateComponentSource(tree));
  });

  it("produces source that type-checks against react-aria-components' real types", () => {
    const tree: CompositionNode = {
      component: "GridList",
      props: { "aria-label": "Do" },
      children: [
        {
          component: "GridListItem",
          props: { textValue: "Fix outage" },
          children: [{ component: "Text", props: {}, children: [] }],
        },
      ],
    };
    const source = generateComponentSource(tree);
    const file = join(process.cwd(), "src", "card-templates", "__smoke.tsx");
    writeFileSync(file, source);
    try {
      const tscBin = join(
        process.cwd(),
        "node_modules",
        "typescript",
        "bin",
        "tsc",
      );
      execFileSync(process.execPath, [tscBin, "--noEmit", "-p", "tsconfig.json"], {
        cwd: process.cwd(),
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (error) {
      const stdout = (error as { stdout?: string }).stdout ?? "";
      throw new Error(`tsc failed:\n${stdout}`);
    } finally {
      unlinkSync(file);
    }
  });
});
