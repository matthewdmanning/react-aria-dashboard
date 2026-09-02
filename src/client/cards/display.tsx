import type * as z from "zod/v4";

import { cardTemplateSchemas } from "../../contract";
import type { CardTemplate } from "./index";

export type TableCardData = z.infer<typeof cardTemplateSchemas.table>;

export const tableCard: CardTemplate<TableCardData> = {
  schema: cardTemplateSchemas.table,
  Component: ({ data }) => (
    <table>
      <thead>
        <tr>
          {data.columns.map(({ key, label }) => (
            <th key={key} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {data.columns.map(({ key }) => (
              <td key={key}>{String(row[key] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export type ListCardData = z.infer<typeof cardTemplateSchemas.list>;

export const listCard: CardTemplate<ListCardData> = {
  schema: cardTemplateSchemas.list,
  Component: ({ data }) => (
    <ul>
      {data.items.map(({ id, title, body }) => (
        <li key={id}>
          <article>
            <h3>{title}</h3>
            {body === undefined ? null : <p>{body}</p>}
          </article>
        </li>
      ))}
    </ul>
  ),
};

export type CalendarCardData = z.infer<typeof cardTemplateSchemas.calendar>;

export const calendarCard: CardTemplate<CalendarCardData> = {
  schema: cardTemplateSchemas.calendar,
  Component: ({ data }) => (
    <ul>
      {data.events.map(({ id, title, start, end }) => (
        <li key={id}>
          {title} <time dateTime={start}>{start}</time>
          {end ? (
            <>
              {" – "}
              <time dateTime={end}>{end}</time>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  ),
};

export type ChartCardData = z.infer<typeof cardTemplateSchemas.chart>;

export const chartCard: CardTemplate<ChartCardData> = {
  schema: cardTemplateSchemas.chart,
  Component: ({ data }) => {
    const maximum = Math.max(1, ...data.series.map(({ value }) => value));
    return (
      <figure>
        <figcaption>{data.title}</figcaption>
        <svg
          role="img"
          aria-label={data.summary}
          viewBox={`0 0 100 ${Math.max(24, data.series.length * 24)}`}
        >
          {data.series.map(({ label, value }, index) => (
            <rect
              key={`${label}-${index}`}
              x="0"
              y={index * 24}
              width={(value / maximum) * 100}
              height="16"
              fill="currentColor"
            >
              <title>{`${label}: ${value}`}</title>
            </rect>
          ))}
        </svg>
      </figure>
    );
  },
};
