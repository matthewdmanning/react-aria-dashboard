import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { chartComponentDefinition, renderComponent } from "../src/dashboard/index";

it("renders a purpose-labelled chart with scaled native SVG bars", () => {
  const html = renderToStaticMarkup(
    renderComponent(chartComponentDefinition, {
      title: "Progress",
      summary: "Beta is twice Alpha.",
      series: [
        { label: "Alpha", value: 1 },
        { label: "Beta", value: 2 },
      ],
    }),
  );

  expect(html).toContain("<figcaption>Progress</figcaption>");
  expect(html).toContain('aria-label="Beta is twice Alpha."');
  expect(html).toContain('width="50"');
  expect(html).toContain('width="100"');
});
