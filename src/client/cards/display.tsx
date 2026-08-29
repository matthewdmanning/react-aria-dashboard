import type * as z from "zod/v4";

import type { CardDefinition } from "../../dashboard";
import { cardVariantSchemas } from "../../dashboard/card-variants";

export type TableCardData = z.infer<typeof cardVariantSchemas.table>;

export const tableCard: CardDefinition<TableCardData> = {
  schema: cardVariantSchemas.table,
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

export type ListCardData = z.infer<typeof cardVariantSchemas.list>;

export const listCard: CardDefinition<ListCardData> = {
  schema: cardVariantSchemas.list,
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

export type CalendarCardData = z.infer<typeof cardVariantSchemas.calendar>;

export const calendarCard: CardDefinition<CalendarCardData> = {
  schema: cardVariantSchemas.calendar,
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

export type ChartCardData = z.infer<typeof cardVariantSchemas.chart>;

export const chartCard: CardDefinition<ChartCardData> = {
  schema: cardVariantSchemas.chart,
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
