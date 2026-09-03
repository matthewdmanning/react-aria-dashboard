/**
 * PROTOTYPE — throwaway. Answers one question: can a declarative composition
 * tree (D22) be validated by a schema that is library-agnostic — the checker
 * itself names no library, only a pluggable registry of {props schema,
 * allowed children} per component name. Swap the registry, same checker.
 *
 * Run: npx tsx examples/schema-checker.prototype.ts
 *
 * Not reviewed, not the real `contract` schema. See card design mode map.
 */
import * as z from "zod/v4";

interface ComponentSpec {
  props: z.ZodType;
  /** "none" = leaf, "any" = accepts any registered component, or an explicit allow-list. */
  children: "none" | "any" | readonly string[];
}

type Registry = Record<string, ComponentSpec>;

interface CompositionNode {
  component: string;
  props: Record<string, unknown>;
  children?: CompositionNode[];
}

function validate(
  node: CompositionNode,
  registry: Registry,
  path = "root",
): string[] {
  const errors: string[] = [];
  const spec = registry[node.component];

  if (!spec) {
    errors.push(`${path}: unknown component "${node.component}"`);
    return errors;
  }

  const propsResult = spec.props.safeParse(node.props);
  if (!propsResult.success) {
    errors.push(
      `${path}: invalid props for "${node.component}" — ${propsResult.error.issues.map((i) => i.message).join("; ")}`,
    );
  }

  const children = node.children ?? [];
  if (spec.children === "none" && children.length > 0) {
    errors.push(`${path}: "${node.component}" accepts no children`);
  } else {
    children.forEach((child, index) => {
      const childPath = `${path} > ${child.component}[${index}]`;
      if (
        Array.isArray(spec.children) &&
        !spec.children.includes(child.component)
      ) {
        errors.push(
          `${childPath}: "${node.component}" does not allow "${child.component}" as a child`,
        );
      }
      errors.push(...validate(child, registry, childPath));
    });
  }

  return errors;
}

// --- Registry A: react-aria-components (a slice matching the Eisenhower prototype) ---
const reactAriaRegistry: Registry = {
  Heading: { props: z.object({ level: z.number().int().min(1).max(6) }), children: "none" },
  Text: { props: z.object({}).strict(), children: "none" },
  Button: { props: z.object({ onPress: z.literal("action").optional() }), children: "none" },
  GridListItem: { props: z.object({ textValue: z.string() }), children: ["Text", "Button"] },
  GridList: {
    props: z.object({ "aria-label": z.string() }),
    children: ["GridListItem"],
  },
};

// --- Registry B: a stand-in for "something besides react-aria-components" ---
// Different names, different prop shapes, different nesting rules — proves the
// checker itself carries no react-aria-components-specific logic.
const radixRegistry: Registry = {
  Heading: { props: z.object({ size: z.enum(["1", "2", "3"]) }), children: "none" },
  Text: { props: z.object({}).strict(), children: "none" },
  Flex: { props: z.object({ direction: z.enum(["row", "column"]) }), children: "any" },
  Card: { props: z.object({}).strict(), children: ["Text", "Flex"] },
};

// --- Hard cases ---
const cases: { name: string; registry: Registry; registryName: string; tree: CompositionNode }[] = [
  {
    name: "valid nested tree",
    registry: reactAriaRegistry,
    registryName: "react-aria-components",
    tree: {
      component: "GridList",
      props: { "aria-label": "Do" },
      children: [
        {
          component: "GridListItem",
          props: { textValue: "Fix outage" },
          children: [{ component: "Text", props: {} }],
        },
      ],
    },
  },
  {
    name: "same tree shape, swapped to a different library's registry — component names don't exist there",
    registry: radixRegistry,
    registryName: "radix (stand-in)",
    tree: {
      component: "GridList",
      props: { "aria-label": "Do" },
      children: [
        {
          component: "GridListItem",
          props: { textValue: "Fix outage" },
          children: [{ component: "Text", props: {} }],
        },
      ],
    },
  },
  {
    name: "valid tree written for the second registry",
    registry: radixRegistry,
    registryName: "radix (stand-in)",
    tree: {
      component: "Card",
      props: {},
      children: [
        { component: "Text", props: {} },
        {
          component: "Flex",
          props: { direction: "row" },
          children: [{ component: "Text", props: {} }],
        },
      ],
    },
  },
  {
    name: "unknown component name",
    registry: reactAriaRegistry,
    registryName: "react-aria-components",
    tree: { component: "Marquee", props: {} },
  },
  {
    name: "bad prop type",
    registry: reactAriaRegistry,
    registryName: "react-aria-components",
    tree: { component: "Heading", props: { level: "two" } },
  },
  {
    name: "disallowed child nesting (Text cannot contain GridListItem)",
    registry: reactAriaRegistry,
    registryName: "react-aria-components",
    tree: {
      component: "GridListItem",
      props: { textValue: "x" },
      children: [
        {
          component: "Text",
          props: {},
          children: [{ component: "GridListItem", props: { textValue: "nested" } }],
        },
      ],
    },
  },
  {
    name: "leaf given children it does not accept",
    registry: reactAriaRegistry,
    registryName: "react-aria-components",
    tree: {
      component: "Text",
      props: {},
      children: [{ component: "Text", props: {} }],
    },
  },
];

for (const { name, registry, registryName, tree } of cases) {
  const errors = validate(tree, registry);
  console.log(`\n=== ${name} [registry: ${registryName}] ===`);
  console.log("tree:", JSON.stringify(tree, null, 2));
  console.log(
    errors.length === 0 ? "VALID" : `INVALID:\n  ${errors.join("\n  ")}`,
  );
}
