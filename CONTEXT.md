# Vocabulary

Terms this project uses, and what each one means. Nothing else defines these; if you find a term defined elsewhere, that is a bug to fix rather than a second opinion.

## Dashboard

An arrangement or ordering of cards on a page or display.

Concretely, a dashboard is a document: an ordered set of card references plus a theme reference. It holds no card contents of its own — a card lives in one pool that the dashboard references into.

There is one dashboard, held as a single object in dashboard configuration. It ships in the default configuration and cannot be created or deleted.

## Card template

The reusable unit: a UI component paired with a JSON schema describing the input data the component displays. The component can render any data that fits the schema.

A card template is whole-widget in grain — a calendar, an Eisenhower plot, a weather widget — not a layout atom. Card templates compose into other card templates.

A card template displays properly formatted data and nothing more. It does not extract, remove, or reformat data.

There are none at present: the five that shipped were deleted (D32) and their shadcn replacements are not written, so a dashboard renders no card today.

## Display-role key

A key in a card template's schema. Display-role keys name **how a value is displayed**, not what it means in an external domain: `COL_HEADER`, `LIST_ITEMS`, and so on.

This is what lets external data reach a template without new code — a formatter maps incoming fields onto display-role keys. A card template's schema may be empty, for a template that takes no input data.

## Card

A card template in use: an id, a title, a reference to a card template, and its state. A card carries no queries — those are stored with the user who supplied them.

A card carries no position, no size, and no theme of its own. Placement belongs to the dashboard that references it, and appearance belongs to the theme that dashboard names. Retitling a card or editing its state changes the card, never the card template. One card template backs any number of cards.

## State

The data a card currently displays, stored already fitting its card template's schema. Rendering is a straight read with no transform.

State is changed by mutations, whatever produced them — a user edit or a query result reshaped by its formatter. A card accepts manual edits to its state whether or not a query also writes it.

## Query

A request made against an integration, bundled with the formatter that reshapes the result. A query names the integration, the query to run against it, and that formatter.

A query is user-specific: it runs under the auth token of the user who supplied it, and it is stored with that user's data rather than on a card. One card can still be fed by several users at once. The adapter is passed the relevant user's secret when an update fires.

A user's queries are theirs by structure, not by permission — the permission matrix does not govern them. The single exception is deletion, which `admin` may also do. Nothing else reaches another user's queries — not read, not edit.

Nothing is shared between queries, deduplicated, or registered centrally. Two queries against the same calendar each run separately and hold their own copy of the result.

A query's result, once stored as card state, is visible to every user of the dashboard. Data enters through one user's authorization and becomes common to all of them. When two users' queries write the same card, the last write wins.

## Formatter

The mapping from a query result's shape onto a card template's display-role keys. A formatter belongs to one query and runs on the way in, before the result is stored as state — never at render time.

A formatter is deterministic: same input, same output, no IO, nothing read from outside its input. It is `"identity"` when the result already matches the schema, a fixed function bundled with the application shell, or a declarative mapping spec — field renaming, fallback chains, defaults, and array mapping.

## Mutation

A named change applied against current state — "mark this task complete" — rather than a snapshot of the state the caller last saw.

Every write is a mutation. Because a mutation describes a change rather than a result, one that replays minutes late still applies correctly, with no version or staleness check. Each mutation type is tagged with the permission category it requires, and requires either `edit` or `write` in that category depending on whether it changes something that exists or creates and destroys.

## Dashboard configuration

The persistent part of a dashboard — what remains when the data flowing through it changes. It holds cards, dashboards, themes, and integrations. Roles are not here — they live in a roles file the source imports. Base colour and typeset are not here either — they are per-user configuration.

## Integration

A shared interface to an external service, defined once. An integration exposes queries that cards draw from, and may also serve as a backup target. The integration itself is server-owned: adding, removing, or redefining one is governed by the `integrations` category.

Authorization is per-user: each user supplies their own auth token for an integration. Two users connected to the same service are using one integration with two tokens, not two integrations. A user's own authorization is theirs by structure — connecting and disconnecting their own account needs no permission.

## Theme

A named set of presentational settings applied to UI components. A theme cannot execute code, read dashboard data, or alter behavior.

A theme's settings are two things: a **typeset** — shadcn's typography system, carrying base text size, line height, block spacing, and the body, heading, and monospace font families — and the presentational fields of `components.json`: `style`, `tailwind.baseColor`, `tailwind.cssVariables`, `iconLibrary`, `rtl`, `menuColor`, and `menuAccent`.

`components.json`'s remaining fields are code structure, not appearance — `aliases`, `rsc`, `tsx`, `tailwind.config`, `tailwind.css`, `tailwind.prefix`, `registries`. A theme does not reach them.

Each user has their own `components.json`, generated by extending a server-owned template: the template holds the structural fields, the user's extension holds the presentational ones. It is regenerated when a user's choices change, never patched — several of those fields cannot be altered after initialization.

Theme definitions live in dashboard configuration; a dashboard references one. A theme's settings are a selection within the dashboard's component library, never arbitrary CSS.

## Component library

The fixed set of presentational components and CSS a dashboard is built from — shadcn/ui, with Tailwind CSS as its theming framework. Declared once, when the dashboard is initialized. No mutation changes it: changing it is a source change.

A theme can only set values the declared library defines. A card template composes that library's components directly — there is no separate structural layer underneath it. Where this project states no default of its own, shadcn/ui's default is the default.

Every colour anywhere in the project — in a card, in a component — is a semantic token from that library's set (`background`, `foreground`, `primary`, `muted-foreground`, `border`, and the rest), never a hex literal or a palette-scale utility. This is what lets one base colour change recolour everything (D26).

## Base color

A modifier of a theme. It controls the default token values generated for the project at initialization or when a preset is applied.

Persistent and per-user: the same card showing the same data renders in different base colours for different users, so base colour belongs to who is looking rather than to the card, the dashboard, or the data.

## Preset

A whole colour token set, in the format of `globals-example.css` — the `@theme inline` mapping, `:root` and `.dark` blocks defining every token as an `oklch(...)` value, and the `@layer base` rules. Not a partial override.

A preset is complete and literal: every semantic-variable-to-colour pair is written out. Generation happens only at build time, at initialization or preset-apply; nothing generates token values at runtime.

`admin` adds presets available to everyone. A user may also add their own; their own presets are theirs by structure and no permission gates them.

## Per-user configuration

The preferences that belong to one user rather than to the dashboard: base colour and typeset. Each user has their own `.env` file or files, and per-user configuration is read from there.

A user owns appearance, expressed in the component library's own semantics — never in CSS. The server owns data and card templates; a user's appearance settings do not reach either.

Secrets never live there. A user's auth tokens are held by the credential store, encrypted at rest and kept on the server host, under a key rotated every 90 days. Dashboard configuration stays shared — it holds what everyone sees — and no credential lives in it.

## Role

A named bundle of permissions, assigned to an account. A role carries no credential. Roles live in a roles file the source imports, not in dashboard configuration: configuring them means editing that file, which takes the same access as editing source code. No mutation reaches a role.

A bundle covers five categories — `data`, `cards`, `presentation`, `integrations`, `roles` — each holding `none`, `read`, `edit`, or `write`. The levels are ranked and each implies the ones below it: `edit` changes something that already exists, and `write` also creates and deletes.

Two roles ship as defaults, not as fixed names. `admin` holds `write` on `data`, `cards`, `presentation`, and `integrations`, and `read` on `roles`. `user` holds `write` on `data`, `read` on `cards`, `presentation`, and `integrations`, and `none` on `roles`.

A role governs shared and server-owned things only. What belongs to one user — their queries, their own integration authorizations, base colour, typeset, and own presets — is theirs by structure, and no permission gates it.

## Account

The identity a caller presents. An account holds a credential and the name of the role assigned to it, and lives in the auth store, outside dashboard data.

The local user — the OS account running the server — has full permissions, equal to `admin`. Any other caller arriving without a credential has no permissions at all.

A caller proves it is the local user by presenting a token only that account can read. Being on the same machine is not proof.

## Settings

The interface through which a user directly manages integrations, themes, and their own appearance — base colour and typeset — without involving an agent. Roles are not edited here: they live in a file the source imports.

Settings is a human screen. Managing an integration here means connecting or disconnecting it — granting and revoking this dashboard's authorization to use a service. What a card draws from that service is its query, not a setting on the connection.
