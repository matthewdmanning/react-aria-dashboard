# Architecture

How this application is built and where each concern lives. Terms used here are defined in [`CONTEXT.md`](CONTEXT.md).

## Central principle

The service exposes one interface. The client and the MCP server are two consumers of that same interface, with no privileged path between them, so a permission or authentication check covers every caller rather than one door of several.

The dashboard is not one fixed object or universal data model. Its structure, data relationships, cards, presentation, and integrations may change when an agent implements the user's request.

## Technical direction

- The frontend uses React, TypeScript, and Vite.
- shadcn/ui is the framework the interface is built from; its components are the default and its own defaults are this project's defaults (D25).
- Tailwind CSS is the theming framework.
- Native HTML and CSS are used where they are sufficient.
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

Dashboard configuration is shared — it holds what every user sees. Per-user preferences (base colour, typeset) are read from each user's own `.env` file or files (D27, D33). Secrets are not kept there: account credentials are stored only as a `crypto.scrypt` hash and compared with `crypto.timingSafeEqual`, and integration tokens are encrypted at rest on the server host under a key rotated every 90 days (D28). A stored token names the key it was sealed under, so a rotation can re-encrypt without a flag day. `CredentialStore` stays the single seam every path goes through to reach a stored secret.

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

A card template's component is a declarative composition of the declared library's components — a tree of real component exports with props and nested children, not free-form JSX, not raw DOM elements, not invented primitives. The service can also assemble one: given a composition tree (`{component, props, children}`), it generates a registry item — real source in the shadcn registry item shape, `name`, `type`, `files`, `dependencies`, `registryDependencies` (D22, D32). The assembler's output and the items the registry serves are therefore the same artifact. This is the one card-template capability the service has; built-in formatters and packages stay source-only. Correctness comes from `tsc --noEmit` against the library's real types, not a hand-maintained parallel schema — the input tree carries no per-component vocabulary of its own.

Scope: static trees only. A widget needing local state or hooks (a stepper's `useState`, a drag-and-drop list's own state) can't be expressed as a composition tree and stays hand-written, reviewed the ordinary way. Drag-and-drop is out of scope for the assembled path. One mechanism either way — hand-written or assembled, upstream or in a differently-run copy of this codebase, the composition is the same real library.

A dashboard declares one presentational library — shadcn/ui — once, at initialization (D23). Hand-written and assembled card templates both compose that library's components directly; there is no separate structural layer beneath it (D25). A theme can only select values that library defines — Tailwind and shadcn's tokens — never arbitrary CSS.

Every colour a card template names is a semantic token from that set, never a hex literal or a palette-scale utility (D26). A card template therefore has no colour of its own: changing the base colour recolours it without touching its source, so one card's source serves every user at once, each seeing their own.

Base colour modifies a theme, controlling the token values generated at initialization or when a preset is applied (D27). A preset is a whole token set in the format of `globals-example.css`, never a partial override. A role holding `cards: write` adds presets for everyone; a user may add their own.

A user owns appearance; the server owns data and card templates (D33). A theme's settings are a typeset — shadcn's typography system — plus the presentational fields of `components.json` (`style`, `tailwind.baseColor`, `tailwind.cssVariables`, `iconLibrary`, `rtl`, `menuColor`, `menuAccent`). That file's structural fields (`aliases`, `rsc`, `tsx`, `tailwind.config`, `tailwind.css`, `tailwind.prefix`, `registries`) stay server-owned and are unreachable through a theme.

`components.json` is per-user, generated by extending a server-owned template rather than edited in place (D34) — several of the fields a user owns cannot be changed after initialization, so a change regenerates the file. The split above is what the two halves of that extension hold.

A running dashboard also serves its own wired-in card templates as a shadcn-compatible registry, over HTTP at `/r/registry.json` and `/r/<name>.json` (D24) — any shadcn-aware client, including one connected over `shadcn mcp`, can search, view, and add a template straight from the running dashboard.

## Rendering path

Data reaches the screen through a fixed path:

1. A query runs against its integration, under the auth token of the user who supplied it (D29).
2. The query's formatter maps the result onto the card template's display-role keys.
3. The result is validated against the card template's schema and stored as the card's state.
4. The card template's component renders that state directly.

The formatter runs on the way in, not at render time, so a card is never persisted with data its template cannot render, and rendering is a straight read with no transform.

Several users share one dashboard, each contributing through their own authorized integrations (D29). A query is stored with its owner's user data, and the adapter is passed that user's secret when an update fires (D30, D32). A result entering through one user's token becomes card state every user sees — a deliberate posture, not an oversight: authorizing an integration contributes its data to a shared surface. When two users' queries write the same card, the last write wins.

## Service surface

The service exposes two operations: `read(scope)` returns state, and `apply(mutations)` applies one or more mutations atomically. MCP tools and client actions are both mutation constructors.

Mutations change cards, the dashboard, themes, and integrations. They never change roles, built-in formatters, or packages — those are source changes, unreachable through the service at any permission level. Card templates are the one exception (D22): the service can assemble one's component from a declarative composition tree, gated by a permission level like any other mutation.

Every request resolves to an account, then a role, then permissions, at one enforcement point. A caller arriving with no credential resolves to full permissions if it is the local user, and to none otherwise (D35). Access is governed in five categories — `data`, `cards`, `presentation`, `integrations`, `roles` — each holding `none`, `read`, `edit`, or `write`, ranked so each level implies the ones below it.

`edit` changes something that already exists; `write` also creates and destroys. A role with `cards: edit` can retitle a card and change what it shows but cannot add or remove one. A mutation's category and required level both follow from its type, so a caller states only its payload and one lookup decides what the caller's bundle must hold.

The matrix governs shared and server-owned things only (D35). What belongs to one user — their queries, base colour, typeset, own presets — is theirs by structure, and no category or level gates it.

Two roles ship as defaults (D35): `admin` (`write` on `data`, `cards`, `presentation`, `integrations`; `read` on `roles`) and `user` (`write` on `data`, `read` on `cards`, `presentation`, and `integrations`, `none` on `roles`). Roles are configured by editing a roles file the source imports — the same access as editing source code — not through the service. They do not live in dashboard configuration.

The local user resolves to full permissions; every other caller without a credential resolves to none. Proof is a token written at startup to `.dashboard/local-user-token`, restricted to the owning account — `chmod` 0600 on POSIX, `icacls` on Windows, where `chmod` grants nothing (D35). `mcp` over stdio is the local user by construction; the browser receives the token in the URL the server prints to its own stdout. Loopback is not itself proof: another OS account on the host can reach the port.

`integrations` governs the integration — the service, its adapter, its query surface — which is shared. A user's own authorization to one is theirs by structure and needs no permission, the same as their queries.

Queries are stored with user data, not on a card (D32). Only the owning user reaches them; `admin` may additionally delete them. Because no shared object holds another user's queries, the privacy D31 requires falls out of the storage boundary rather than from filtering on read.

`read("role")` returns the caller's own resolved role and is never gated — a caller may always see what it may do, which is not the same as reading the role list.

A failed call carries the service's own name for the failure — a denial, an unknown id, something still in use — so an adapter maps that name to its own vocabulary rather than matching on message text.

`read(scope)` returns one category, or `all` for every category the caller may read — denied categories are omitted rather than failing the whole call, so a role short of one category still loads a dashboard. A consumer of `all` therefore holds a partial configuration, and must tell an omitted category from an empty one rather than filling the gap.

The client reaches the service over one endpoint pair, one operation each. There is no endpoint per action: every client action is a mutation, so a new action needs no new route and no second permission check.

Mutations in `integrations` require a live service. Every other mutation queues offline and replays on reconnect. `roles` has no mutations to queue.
