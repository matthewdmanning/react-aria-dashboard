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

## Panel

A panel is an independent unit composed of:

- a UI; and
- a JSON Schema describing the data the UI can display.

The UI and JSON Schema form a contract: the UI can render the contents of any properly formatted data that fits the schema.

A panel is responsible only for displaying properly formatted data. It does not extract, remove, or reformat source data.

## Data formatting and wiring

Formatting is separate code, even when a formatter is used by only one panel. A formatter may extract or reformat source data, including removing fields that the panel does not need.

The agent creates and maintains the wiring between source data, formatter code, the panel's JSON Schema, and the panel UI. Defining and changing this wiring is within the project's scope.

The agent is responsible for ensuring that formatted data fits the panel's JSON Schema and that the panel UI can render it. Project-level validation or preview of formatter output is not part of this architecture.

## Agent responsibility

In response to user prompts, the agent may create or change:

- dashboard structure and panel arrangement;
- panel UIs and JSON Schemas;
- formatter code and data wiring;
- dashboard data and data relationships;
- presentation, settings, and integrations; and
- any other part of the dashboard needed to fulfill the request.

Record schemas, record collections, and predefined display catalogs are not universal dashboard structures. An agent may use such structures for a particular dashboard when the user's request calls for them.

Sensitive data handling inside an agent-created panel is outside this project's scope. Repository content must never expose sensitive field names or values.

## Legacy quarantine

Superseded architecture, implementation, tests, examples, issues, branches, and audit material are not sources of current requirements. Material explicitly placed in a legacy or quarantine location remains available only for historical reference and must not be used by the active application, build, tests, examples, documentation routing, or coding agents.
