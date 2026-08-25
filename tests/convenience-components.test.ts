import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import {
  cardsComponentDefinition,
  renderComponent,
  tableComponentDefinition,
} from "../src/dashboard/index";

it("renders table and cards data through the shared component contract", () => {
  expect(
    renderToStaticMarkup(
      renderComponent(tableComponentDefinition, {
        columns: [{ key: "name", label: "Name" }],
        rows: [{ name: "Ada" }],
      }),
    ),
  ).toBe(
    '<table><thead><tr><th scope="col">Name</th></tr></thead><tbody><tr><td>Ada</td></tr></tbody></table>',
  );
  expect(
    renderToStaticMarkup(
      renderComponent(cardsComponentDefinition, {
        items: [{ id: "one", title: "One", body: "Body" }],
      }),
    ),
  ).toBe("<ul><li><article><h2>One</h2><p>Body</p></article></li></ul>");
  expect(() =>
    renderComponent(tableComponentDefinition, { columns: [], rows: [42] }),
  ).toThrow("Invalid component data");
});
