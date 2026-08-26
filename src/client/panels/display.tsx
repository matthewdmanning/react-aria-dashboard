import type { PanelDefinition } from "../../dashboard";

export interface TablePanelData {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
}

export const tablePanel: PanelDefinition<TablePanelData> = {
  schema: {
    type: "object",
    properties: {
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: { key: { type: "string" }, label: { type: "string" } },
          required: ["key", "label"],
          additionalProperties: false,
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: {
            anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
          },
        },
      },
    },
    required: ["columns", "rows"],
    additionalProperties: false,
  },
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

export interface CardsPanelData {
  items: { id: string; title: string; body?: string }[];
}

export const cardsPanel: PanelDefinition<CardsPanelData> = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
          },
          required: ["id", "title"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
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

export interface CalendarPanelData {
  events: { id: string; title: string; start: string; end?: string }[];
}

export const calendarPanel: PanelDefinition<CalendarPanelData> = {
  schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
          },
          required: ["id", "title", "start"],
          additionalProperties: false,
        },
      },
    },
    required: ["events"],
    additionalProperties: false,
  },
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

export interface ChartPanelData {
  title: string;
  summary: string;
  series: { label: string; value: number }[];
}

export const chartPanel: PanelDefinition<ChartPanelData> = {
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      series: {
        type: "array",
        items: {
          type: "object",
          properties: { label: { type: "string" }, value: { type: "number" } },
          required: ["label", "value"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "summary", "series"],
    additionalProperties: false,
  },
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
