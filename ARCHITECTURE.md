# Architecture

How this application is built and where each concern lives. Terms used here are defined in [`CONTEXT.md`](CONTEXT.md).

## Central principle

The service exposes one interface. The client and the MCP server are two consumers of that same interface, with no privileged path between them, so a permission or authentication check covers every caller rather than one door of several.

The dashboard is not one fixed object or universal data model. Its structure, data relationships, cards, presentation, and integrations may change when an agent implements the user's request.

## Technical direction

- The frontend uses React, TypeScript, and Vite.
- React Aria Components provides accessible interaction behavior for complex controls.
- Native HTML and CSS are used where they are sufficient.
- CSS custom properties support the declarative theme system.
- A small Node.js backend provides atomic JSON persistence, external-service integrations, external-access authentication, and MCP tools.
- There is no database.

## Module map

Seven modules:

| Module           | Owns                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract`       | Dashboard configuration shape and validation, mutation types, formatter compilation, card template schemas, role bundle shape. No React, no Node — imported by every other module. |
| `service`        | The one interface. Role resolution and enforcement, persistence, applying mutations.                                                                                               |
| `auth`           | Accounts, credentials, account-to-role resolution. Separate store from dashboard data.                                                                                             |
| `integrations`   | Optional, user-authorized external-service connections, and backup targets.                                                                                                        |
| `view`           | React application: rendering, Settings, offline cache, mutation queue, toast.                                                                                                      |
| `card-templates` | Card template components, paired with their schemas from `contract`. Split out on change cadence: these are added by source change, not through the service.                       |
| `mcp`            | Tool definitions. Calls `service`.                                                                                                                                                 |

Runtime dashboard data and installed themes live at a configurable path outside `src/`.

## Rewrite in progress

The module map above is the target cut. The rewrite lands issue by issue, so parts of `src/` do not match it yet:

| Module           | State                                                 |
| ---------------- | ----------------------------------------------------- |
| `contract`       | Written, at `src/contract/`                           |
| `service`        | Written, at `src/service/`                            |
| `auth`           | Written, at `src/auth/`                               |
| `mcp`            | Rewritten onto `service`, at `src/mcp/`; tested       |
| `integrations`   | Not split out; lives under `src/server/integrations/` |
| `view`           | Not renamed; lives at `src/client/`; on `service`     |
| `card-templates` | Not split out; components live at `src/client/cards/` |

Delete this section when the last module lands.

## Card templates in the codebase

A card template is split across two places, and both halves must agree:

- `contract` holds each template's schema.
- The card template's component renders data fitting that schema.

Adding a card template by hand is an ordinary source change, reviewed like any other.

A card template's component is a declarative composition of `react-aria-components` — a tree of real component exports with props and nested children, not free-form JSX, not raw DOM elements, not invented primitives. The service can also assemble one: given a composition tree (`{component, props, children}`), it generates the component's real source from the library's real exports (D22). This is the one card-template capability the service has; roles, built-in formatters, and packages stay source-only. Correctness comes from `tsc --noEmit` against the library's real types, not a hand-maintained parallel schema — the input tree carries no per-component vocabulary of its own.

Scope: static trees only. A widget needing local state or hooks (`useDragAndDrop`, `useListData`, a stepper's `useState`) can't be expressed as a composition tree and stays hand-written, reviewed the ordinary way. Drag-and-drop is out of scope for the assembled path. One mechanism either way — hand-written or assembled, upstream or in a differently-run copy of this codebase, the composition is the same real library.

A dashboard declares one presentational library — shadcn/ui today — once, at initialization (D23). `react-aria-components` is the structural layer both hand-written and assembled card templates compose; the declared library governs how that composition looks. A theme can only select values that library defines, never arbitrary CSS.

A running dashboard also serves its own wired-in card templates as a shadcn-compatible registry, over HTTP at `/r/registry.json` and `/r/<name>.json` (D24) — any shadcn-aware client, including one connected over `shadcn mcp`, can search, view, and add a template straight from the running dashboard.

## Rendering path

Data reaches the screen through a fixed path:

1. A card's query runs against its integration.
2. The query's formatter maps the result onto the card template's display-role keys.
3. The result is validated against the card template's schema and stored as the card's state.
4. The card template's component renders that state directly.

The formatter runs on the way in, not at render time, so a card is never persisted with data its template cannot render, and rendering is a straight read with no transform.

## Service surface

The service exposes two operations: `read(scope)` returns state, and `apply(mutations)` applies one or more mutations atomically. MCP tools and client actions are both mutation constructors.

Mutations change cards, the dashboard, themes, and integrations. They never change roles, built-in formatters, or packages — those are source changes, unreachable through the service at any permission level. Card templates are the one exception (D22): the service can assemble one's component from a declarative composition tree, gated by a permission level like any other mutation.

Every request resolves to an account, then a role, then permissions, at one enforcement point. A caller arriving with no credential resolves to the role named `local`. Access is governed in five categories — `data`, `cards`, `presentation`, `integrations`, `roles` — each holding `none`, `read`, `edit`, or `write`, ranked so each level implies the ones below it.

`edit` changes something that already exists; `write` also creates and destroys. A role with `cards: edit` can retitle a card and change what it shows but cannot add or remove one. A mutation's category and required level both follow from its type, so a caller states only its payload and one lookup decides what the caller's bundle must hold.

`read("role")` returns the caller's own resolved role and is never gated — a caller may always see what it may do, which is not the same as reading the role list.

A failed call carries the service's own name for the failure — a denial, an unknown id, something still in use — so an adapter maps that name to its own vocabulary rather than matching on message text.

`read(scope)` returns one category, or `all` for every category the caller may read — denied categories are omitted rather than failing the whole call, so a role short of one category still loads a dashboard. A consumer of `all` therefore holds a partial configuration, and must tell an omitted category from an empty one rather than filling the gap.

The client reaches the service over one endpoint pair, one operation each. There is no endpoint per action: every client action is a mutation, so a new action needs no new route and no second permission check.

Mutations in `integrations` require a live service. Every other mutation queues offline and replays on reconnect. `roles` has no mutations to queue.
