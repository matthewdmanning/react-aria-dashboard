# Dashboard Architecture

## Authority

This document is the authoritative source for the dashboard architecture. It supersedes conflicting architecture statements in every other repository document. Other documents may specify product requirements, but they must not redefine the architecture established here.

## Central principle

The standalone dashboard MCP module provides the interface through which an agent can change any or all parts of a dashboard in response to user prompts.

The dashboard is not one fixed object or universal data model. Its structure, data relationships, panels, code, presentation, and integrations may change when the agent implements the user's request.

## Dashboard configuration

Dashboard configuration is persistent configuration for integrations, the selected UI theme, font scaling, agent permissions, panels, panel wiring, and panel arrangement.

The defined configuration structure records these dashboard concerns without imposing one universal structure on panel data, relationships, UI code, JSON Schemas, or formatter code.

## Settings UI

Settings is the user interface through which a user directly manages integrations, the selected UI theme, font scaling, and agent permissions without interacting with an agent.

Settings changes dashboard configuration through the same persistence interface used by the rest of the application. Settings does not create or edit panels, formatter code, panel wiring, or panel arrangement.

## Dashboard

A dashboard specifies the arrangement or ordering of panels on a page or display.

## Panel kind

A panel kind is a fixed pair, defined in application source, not by the agent:

- a UI component; and
- a JSON Schema describing the data the component can display.

The component and schema form a contract: the component can render the contents of any data that fits the schema. Kinds are few and rarely added — adding one is an ordinary code change, reviewed like any other, not an operation the MCP interface exposes. A kind is responsible only for displaying properly formatted data; it does not extract, remove, or reformat source data.

## Panel

A panel is data, never code: an id, a title, a reference to a panel kind, a data source, and a formatter. A panel is responsible only for choosing and configuring a kind — it carries no UI or schema of its own.

## Data formatting and wiring

A formatter is either `"identity"` (the source data already matches the panel kind's schema — a human or an agent wrote it directly, e.g. a prioritized task list), a fixed named function bundled with the application shell (not agent-editable), or a declarative mapping spec: field renaming, fallback chains, defaults, and array mapping over source data. Formatting is never arbitrary agent-authored code.

The agent creates and maintains the wiring between source data, a formatter, a panel kind, and the panel's position in the dashboard. Defining and changing this wiring is within the project's scope. The agent is responsible for ensuring that formatted data fits the panel kind's JSON Schema; the MCP server validates this proactively wherever the formatter can be evaluated server-side (identity or a declarative spec).

## Agent responsibility

In response to user prompts, the agent may create or change:

- dashboard structure and panel arrangement;
- panels: their kind, data source, and formatter (data, not code);
- dashboard data and data relationships;
- presentation, settings, and integrations; and
- any other part of the dashboard needed to fulfill the request, within the fixed set of panel kinds available.

Record schemas, record collections, and predefined display catalogs are not universal dashboard structures. An agent may use such structures for a particular dashboard when the user's request calls for them. Panel kinds are exactly such a catalog: the fixed set available at a given time, extended only through a source code change, never through the MCP interface.

Sensitive data handling inside an agent-created panel is outside this project's scope. Repository content must never expose sensitive field names or values.

## Legacy quarantine

Superseded architecture, implementation, tests, examples, issues, branches, and audit material are not sources of current requirements. Material explicitly placed in a legacy or quarantine location remains available only for historical reference and must not be used by the active application, build, tests, examples, documentation routing, or coding agents.
