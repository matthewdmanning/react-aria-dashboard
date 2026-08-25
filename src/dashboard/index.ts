import Ajv, { type AnySchema } from "ajv";
import {
  createContext,
  createElement,
  useContext,
  type ChangeEvent,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";

export type JsonSchema = AnySchema;

export interface ComponentDefinition<T> {
  schema: JsonSchema;
  Component: ComponentType<{ data: T }>;
}

const ajv = new Ajv();

export function renderComponent<T>(
  definition: ComponentDefinition<T>,
  data: unknown,
): ReactElement {
  const validate = ajv.compile<T>(definition.schema);

  if (!validate(data)) {
    throw new Error(`Invalid component data: ${ajv.errorsText(validate.errors)}`);
  }

  return createElement(definition.Component, { data: data as T });
}

type ThemeTreatment = Record<string, string | number>;

export interface UiTheme {
  id: string;
  tokens: ThemeTreatment;
  semanticRoles: Record<string, ThemeTreatment>;
}

const SemanticRoleContext = createContext<{
  assignments: Record<string, string>;
  theme: UiTheme;
} | null>(null);
const DataSourceUpdateContext = createContext<
  ((data: unknown) => void | Promise<void>) | null
>(null);

export function useSemanticRole(field: string): {
  "data-semantic-role"?: string;
  style?: CSSProperties;
} {
  const context = useContext(SemanticRoleContext);
  const role = context?.assignments[field];
  const treatment = role && context.theme.semanticRoles[role];

  return treatment
    ? { "data-semantic-role": role, style: treatment as CSSProperties }
    : {};
}

function SemanticField({
  as,
  field,
  children,
}: {
  as: "p" | "h2" | "td" | "span";
  field: string;
  children?: ReactNode;
}) {
  return createElement(as, useSemanticRole(field), children);
}

interface MessageData {
  message: string;
}

export const messageComponentDefinition: ComponentDefinition<MessageData> = {
  schema: {
    type: "object",
    properties: { message: { type: "string" } },
    required: ["message"],
    additionalProperties: false,
  },
  Component: ({ data }) =>
    createElement(SemanticField, { as: "p", field: "message" }, data.message),
};

interface TableData {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
}

export const tableComponentDefinition: ComponentDefinition<TableData> = {
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
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "null" },
            ],
          },
        },
      },
    },
    required: ["columns", "rows"],
    additionalProperties: false,
  },
  Component: ({ data }) =>
    createElement(
      "table",
      null,
      createElement(
        "thead",
        null,
        createElement(
          "tr",
          null,
          ...data.columns.map(({ key, label }) =>
            createElement("th", { key, scope: "col" }, label),
          ),
        ),
      ),
      createElement(
        "tbody",
        null,
        ...data.rows.map((row, rowIndex) =>
          createElement(
            "tr",
            { key: rowIndex },
            ...data.columns.map(({ key }) =>
              createElement(
                SemanticField,
                { key, as: "td", field: key },
                String(row[key] ?? ""),
              ),
            ),
          ),
        ),
      ),
    ),
};

interface CardsData {
  items: { id: string; title: string; body?: string }[];
}

export const cardsComponentDefinition: ComponentDefinition<CardsData> = {
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
  Component: ({ data }) =>
    createElement(
      "ul",
      null,
      ...data.items.map(({ id, title, body }) =>
        createElement(
          "li",
          { key: id },
          createElement(
            "article",
            null,
            createElement(
              SemanticField,
              { as: "h2", field: "title" },
              title,
            ),
            body === undefined
              ? null
              : createElement(
                  SemanticField,
                  { as: "p", field: "body" },
                  body,
                ),
          ),
        ),
      ),
    ),
};

export interface ChecklistData {
  items: { id: string; label: string; completed: boolean }[];
}

export function completeChecklistItem(
  data: ChecklistData,
  id: string,
  completed: boolean,
): ChecklistData {
  if (!data.items.some((item) => item.id === id)) {
    throw new Error(`Checklist item not found: ${id}`);
  }
  return {
    items: data.items.map((item) =>
      item.id === id ? { ...item, completed } : item,
    ),
  };
}

export const checklistComponentDefinition: ComponentDefinition<ChecklistData> = {
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            completed: { type: "boolean" },
          },
          required: ["id", "label", "completed"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  Component: ({ data }) => {
    const update = useContext(DataSourceUpdateContext);
    return createElement(
      "ul",
      null,
      ...data.items.map((item) =>
        createElement(
          "li",
          { key: item.id },
          createElement(
            "label",
            null,
            createElement("input", {
              type: "checkbox",
              checked: item.completed,
              readOnly: !update,
              onChange: update
                ? (event: ChangeEvent<HTMLInputElement>) =>
                    void update(
                      completeChecklistItem(
                        data,
                        item.id,
                        event.currentTarget.checked,
                      ),
                    )
                : undefined,
            }),
            item.label,
          ),
        ),
      ),
    );
  },
};

interface CalendarData {
  events: {
    id: string;
    title: string;
    start: string;
    end?: string;
  }[];
}

export const calendarComponentDefinition: ComponentDefinition<CalendarData> = {
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
  Component: ({ data }) =>
    createElement(
      "ul",
      null,
      ...data.events.map(({ id, title, start, end }) =>
        createElement(
          "li",
          { key: id },
          createElement(SemanticField, { as: "span", field: "title" }, title),
          " ",
          createElement(
            SemanticField,
            { as: "span", field: "start" },
            createElement("time", { dateTime: start }, start),
          ),
          end === undefined ? null : "–",
          end === undefined
            ? null
            : createElement(
                SemanticField,
                { as: "span", field: "end" },
                createElement("time", { dateTime: end }, end),
              ),
        ),
      ),
    ),
};

interface ChartData {
  title: string;
  summary: string;
  series: { label: string; value: number }[];
}

export const chartComponentDefinition: ComponentDefinition<ChartData> = {
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      series: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number", minimum: 0 },
          },
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
    return createElement(
      "figure",
      null,
      createElement("figcaption", null, data.title),
      createElement(SemanticField, { as: "p", field: "summary" }, data.summary),
      createElement(
        "svg",
        {
          role: "img",
          "aria-label": data.summary,
          viewBox: `0 0 100 ${Math.max(24, data.series.length * 24)}`,
        },
        ...data.series.map(({ label, value }, index) =>
          createElement(
            "rect",
            {
              key: `${label}-${index}`,
              x: 0,
              y: index * 24,
              width: (value / maximum) * 100,
              height: 16,
              fill: "currentColor",
            },
            createElement("title", null, `${label}: ${value}`),
          ),
        ),
      ),
    );
  },
};

export const componentDefinitions = {
  message: messageComponentDefinition,
  table: tableComponentDefinition,
  cards: cardsComponentDefinition,
  checklist: checklistComponentDefinition,
  calendar: calendarComponentDefinition,
  chart: chartComponentDefinition,
} as const;

export type ComponentDefinitionName = keyof typeof componentDefinitions;

export function renderRegisteredComponent(
  definition: ComponentDefinitionName,
  data: unknown,
): ReactElement {
  return renderComponent(
    componentDefinitions[definition] as ComponentDefinition<unknown>,
    data,
  );
}

export interface DashboardConfiguration {
  header: { title: string };
  settings: { theme: string };
  dataSources: { id: string; data: unknown }[];
  componentInstances: {
    id: string;
    definition: ComponentDefinitionName;
    dataSource: string;
    semanticRoles?: Record<string, string>;
  }[];
  arrangement: string[];
}

const dashboardConfigurationSchema: JsonSchema = {
  type: "object",
  properties: {
    header: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
      additionalProperties: false,
    },
    settings: {
      type: "object",
      properties: { theme: { type: "string" } },
      required: ["theme"],
      additionalProperties: false,
    },
    dataSources: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, data: {} },
        required: ["id", "data"],
        additionalProperties: false,
      },
    },
    componentInstances: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          definition: { enum: Object.keys(componentDefinitions) },
          dataSource: { type: "string" },
          semanticRoles: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        required: ["id", "definition", "dataSource"],
        additionalProperties: false,
      },
    },
    arrangement: { type: "array", items: { type: "string" } },
  },
  required: [
    "header",
    "settings",
    "dataSources",
    "componentInstances",
    "arrangement",
  ],
  additionalProperties: false,
};

const validateDashboardConfiguration =
  ajv.compile<DashboardConfiguration>(dashboardConfigurationSchema);

const treatmentSchema: JsonSchema = {
  type: "object",
  propertyNames: { pattern: "^--[a-z0-9-]+$" },
  additionalProperties: {
    anyOf: [{ type: "string" }, { type: "number" }],
  },
};

const validateUiTheme = ajv.compile<UiTheme>({
  type: "object",
  properties: {
    id: { type: "string" },
    tokens: treatmentSchema,
    semanticRoles: {
      type: "object",
      additionalProperties: treatmentSchema,
    },
  },
  required: ["id", "tokens", "semanticRoles"],
  additionalProperties: false,
});

export function parseDashboardConfiguration(
  candidate: unknown,
): DashboardConfiguration {
  if (!validateDashboardConfiguration(candidate)) {
    throw new Error(
      `Invalid dashboard configuration: ${ajv.errorsText(validateDashboardConfiguration.errors)}`,
    );
  }

  const dataSourceIds = new Set(candidate.dataSources.map(({ id }) => id));
  const instances = new Map(
    candidate.componentInstances.map((instance) => [instance.id, instance]),
  );
  const arrangedIds = new Set(candidate.arrangement);

  if (
    dataSourceIds.size !== candidate.dataSources.length ||
    instances.size !== candidate.componentInstances.length ||
    arrangedIds.size !== candidate.arrangement.length ||
    candidate.arrangement.length !== instances.size ||
    candidate.componentInstances.some(
      ({ dataSource }) => !dataSourceIds.has(dataSource),
    ) ||
    candidate.arrangement.some((id) => !instances.has(id))
  ) {
    throw new Error("Invalid dashboard configuration: broken or duplicate id");
  }

  const dataSources = new Map(candidate.dataSources.map(({ id, data }) => [id, data]));
  for (const instance of candidate.componentInstances) {
    renderRegisteredComponent(
      instance.definition,
      dataSources.get(instance.dataSource),
    );
  }

  return candidate;
}

export function parseUiTheme(candidate: unknown): UiTheme {
  if (!validateUiTheme(candidate)) {
    throw new Error(`Invalid UI theme: ${ajv.errorsText(validateUiTheme.errors)}`);
  }
  return candidate;
}

export function renderDashboard(
  candidate: unknown,
  themeCandidates: unknown[],
  updateDataSource?: (id: string, data: unknown) => void | Promise<void>,
): ReactElement {
  const configuration = parseDashboardConfiguration(candidate);
  const theme = themeCandidates
    .map(parseUiTheme)
    .find(({ id }) => id === configuration.settings.theme);

  if (!theme) {
    throw new Error("Invalid dashboard configuration: selected theme not found");
  }

  const dataSources = new Map(
    configuration.dataSources.map(({ id, data }) => [id, data]),
  );
  const instances = new Map(
    configuration.componentInstances.map((instance) => [instance.id, instance]),
  );

  if (
    configuration.componentInstances.some(({ semanticRoles = {} }) =>
      Object.values(semanticRoles).some(
        (role) => theme.semanticRoles[role] === undefined,
      ),
    )
  ) {
    throw new Error("Invalid dashboard configuration: semantic role not found");
  }

  return createElement(
    "main",
    {
      "data-theme": configuration.settings.theme,
      style: theme.tokens as CSSProperties,
    },
    createElement(
      "header",
      null,
      createElement("h1", null, configuration.header.title),
    ),
    ...configuration.arrangement.map((id) => {
      const instance = instances.get(id)!;
      return createElement(
        "section",
        { key: id },
        createElement(
          SemanticRoleContext.Provider,
          {
            value: {
              assignments: instance.semanticRoles ?? {},
              theme,
            },
          },
          createElement(
            DataSourceUpdateContext.Provider,
            {
              value: updateDataSource
                ? (data) => updateDataSource(instance.dataSource, data)
                : null,
            },
            renderRegisteredComponent(
              instance.definition,
              dataSources.get(instance.dataSource),
            ),
          ),
        ),
      );
    }),
  );
}
