# Architecture

How this application is built and where each concern lives. Terms used here are defined in [`CONTEXT.md`](CONTEXT.md).

## Central principle

The standalone dashboard MCP module provides the interface through which an agent can change any or all parts of a dashboard in response to user prompts.

The dashboard is not one fixed object or universal data model. Its structure, data relationships, cards, presentation, and integrations may change when the agent implements the user's request.

## Technical direction

- The frontend uses React, TypeScript, and Vite.
- React Aria Components provides accessible interaction behavior for complex controls.
- Native HTML and CSS are used where they are sufficient.
- CSS custom properties support the declarative theme system.
- A small Node.js backend provides atomic JSON persistence, Google integrations, external-access authentication, and MCP tools.
- There is no database.

## Module map

- `src/dashboard/` is the central domain module; callers use its interface through `index.ts`. It owns the configuration schema, validation, the card template registry, and formatter compilation.
- `src/client/` contains the React UI, the card template components, and themes.
- `src/server/` owns persistence, authentication, and external integrations.
- `src/mcp/` owns the standalone MCP server and its tools.

Runtime dashboard data and installed themes live at a configurable path outside `src/`.

## Card templates in the codebase

A card template is split across two modules, and both halves must agree:

- `src/dashboard/card-templates.ts` holds each template's schema.
- `src/client/cards/` holds each template's component, paired with its schema in a `CardDefinition`.

Adding a card template is an ordinary source change, reviewed like any other. The MCP interface does not expose it.

## Rendering path

Source data reaches the screen through a fixed path:

1. A card names a source and a formatter.
2. The formatter maps the source's shape onto the card template's display-role keys.
3. The result is validated against the card template's schema.
4. The card template's component renders it.

The MCP server validates step 3 ahead of time wherever the formatter can be evaluated server-side — `identity` or a declarative spec — so a card is never persisted with data its template cannot render.

## MCP surface

`src/mcp/` mutates cards, wiring, and arrangement. It never mutates card templates, which exist only in source.

Agent access is governed by permissions stored in dashboard configuration, in three categories: `cards`, `data`, and `configuration`.
