import ts from "typescript";

// RAC intrinsic tags a hand-rolled element must never reimplement.
// Denylist, not an allowlist: components stay freely composable, this
// only blocks the raw HTML tags React Aria Components already covers.
const racCoveredTags: Record<string, string> = {
  button: "Button",
  input: "TextField or Checkbox",
  select: "Select or ListBox",
  textarea: "TextField",
  option: "ListBoxItem or Item",
};

const hexOrPixelLiteral = /#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?px\b/;

export interface PanelValidationError {
  line: number;
  message: string;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

export function validatePanelComponentGovernance(
  source: string,
): PanelValidationError[] {
  const file = ts.createSourceFile(
    "panel.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const errors: PanelValidationError[] = [];

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningLikeElement(node)) {
      const tagName = node.tagName.getText(file);
      const racComponent = racCoveredTags[tagName];
      if (racComponent) {
        errors.push({
          line: lineOf(file, node),
          message: `Use React Aria Components' <${racComponent}> instead of the raw <${tagName}> element`,
        });
      }
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(file) === "style"
        ) {
          errors.push({
            line: lineOf(file, attribute),
            message:
              "Style only through theme tokens (CSS custom properties) and Chota classNames, not inline style={{}}",
          });
        }
      }
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      hexOrPixelLiteral.test(node.text)
    ) {
      errors.push({
        line: lineOf(file, node),
        message: `Literal value "${node.text}" bypasses theme tokens; use a CSS custom property instead`,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return errors;
}

export function formatPanelValidationErrors(
  errors: PanelValidationError[],
): string {
  return errors
    .map((error) => `panel.tsx:${error.line}: ${error.message}`)
    .join("\n");
}
