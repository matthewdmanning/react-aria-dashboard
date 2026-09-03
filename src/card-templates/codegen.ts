import type { CompositionNode } from "../contract";

/**
 * Pure: composition tree in, TSX source text out. No IO, no validation that
 * `component`/`props` name real react-aria-components exports — tsc is the
 * truth for that (D22). Same tree always produces the same string.
 */
export function generateComponentSource(
  root: CompositionNode,
  componentName = "GeneratedCardTemplate",
): string {
  const usedComponents = new Set<string>();
  collectComponents(root, usedComponents);
  const imports = [...usedComponents].sort().join(", ");

  return `import { ${imports} } from "react-aria-components";

export function ${componentName}() {
  return (
${renderNode(root, 4)}
  );
}
`;
}

function collectComponents(node: CompositionNode, into: Set<string>): void {
  into.add(node.component);
  for (const child of node.children) collectComponents(child, into);
}

function renderNode(node: CompositionNode, indent: number): string {
  const pad = " ".repeat(indent);
  const props = renderProps(node.props);
  const attrs = props ? ` ${props}` : "";

  if (node.children.length === 0) {
    return `${pad}<${node.component}${attrs} />`;
  }

  const children = node.children
    .map((child) => renderNode(child, indent + 2))
    .join("\n");
  return `${pad}<${node.component}${attrs}>\n${children}\n${pad}</${node.component}>`;
}

function renderProps(props: Record<string, unknown>): string {
  return Object.keys(props)
    .sort()
    .map((key) => renderProp(key, props[key]))
    .join(" ");
}

function renderProp(key: string, value: unknown): string {
  if (typeof value === "string") return `${key}=${JSON.stringify(value)}`;
  return `${key}={${JSON.stringify(value)}}`;
}
