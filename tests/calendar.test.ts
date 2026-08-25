import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import {
  calendarComponentDefinition,
  renderComponent,
} from "../src/dashboard/index";

it("renders calendar events without coupling them to an external service", () => {
  expect(
    renderToStaticMarkup(
      renderComponent(calendarComponentDefinition, {
        events: [
          {
            id: "one",
            title: "Review",
            start: "2026-08-24T14:00:00Z",
            end: "2026-08-24T15:00:00Z",
          },
        ],
      }),
    ),
  ).toBe(
    '<ul><li><span>Review</span> <span><time dateTime="2026-08-24T14:00:00Z">2026-08-24T14:00:00Z</time></span>–<span><time dateTime="2026-08-24T15:00:00Z">2026-08-24T15:00:00Z</time></span></li></ul>',
  );
});
