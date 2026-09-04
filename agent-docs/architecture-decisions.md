# Architecture decisions — grilling session, 2026-08-31

## Status

**Work in progress. Deliberately ahead of the codebase.**

This document does not need to agree with the code, and a disagreement is not a bug to fix here. The code describes what exists; this document describes what was decided.

`ARCHITECTURE.md` and `CONTEXT.md` have caught up — both were rewritten to these decisions in `cd8e98e` (#65), so they now describe the target rather than the tree. `ARCHITECTURE.md` carries a "Rewrite in progress" section mapping each module to what is actually in `src/` today.

**When planning, this document is the authoritative source of truth.** Where it conflicts with anything else, it wins.

Every item is settled. Nothing here is open.

D19 and D20 were decided on 2026-09-01, after the session, while `service` was being written for #60. They are recorded here because this document is where decisions live, not because the session reopened.

Scope of this session: the contracts between parts of the application. Vocabulary changes: `role`, `account`, `mutation`, and `query` are added; `source`, `wiring`, and `style` are deleted. Everything else is a term already in `CONTEXT.md`.

Decisions are recorded as they were settled. The application is pre-alpha and non-functional: nothing is released, no stored data belongs to anyone, and nothing depends on current behaviour. So no decision here is constrained by back-compat, gradual migration, deprecation windows, or avoiding a name clash with what exists. Where a decision replaces something, the old thing is deleted outright.

---

## Decisions

### D1 — One service interface; client and MCP are peers over it

The service exposes one interface. The client and the MCP server are two consumers of that same interface, with no privileged path between them.

Rejected: MCP reaching persistence through a shared library, or MCP owning its own copy of persistence and path-containment logic. Both produce more than one door to the same file, and a permission or authentication check on one door does not cover the other.

Consequence: the MCP server cannot run without the service process.

### D2 — Role is a named bundle of permissions

`role` enters the vocabulary with its ordinary meaning in authentication: a named set of permissions, bundled together and assigned to an account.

`account` enters the vocabulary as the identity a caller presents. How accounts are created and how a role is assigned to an account is out of scope for this session.

There is no separate "developer" and "user" concept in the architecture. What distinguishes those two kinds of work is which door the change goes through, not which role holds it:

- changes to dashboard configuration go through the service, governed by a role
- changes to card templates, built-in formatters, and packages are source changes, reviewed like any other code change, and are not reachable through the service at any permission level (D22 narrows this: assembling a card template's component from a declarative composition tree is one specific service capability, gated by a permission level like any other mutation — built-in formatters and packages are untouched)

### D3 — Roles live in dashboard configuration; accounts live in the auth store

Split at the credential line:

- **Roles** — name plus permission bundle — live in dashboard configuration. They carry no credential. (D19 removed "and are edited through Settings": roles are changed at source.)
- **Accounts** — credential plus assigned role name — live in the auth store, outside dashboard data.

The service resolves account, then role, then permissions, on every call.

This satisfies both product-spec constraints that were pulling apart: Settings remains the interface for changing agent permissions, and credentials and tokens stay out of dashboard data.

The escalation guard followed: a write to dashboard configuration may not widen the role bundle held by the caller making it. D19 makes it moot — there is no write that reaches a role — and the guard was deleted from `service` rather than kept as dead enforcement.

### D4 — One enforcement point

Every request resolves to a role. There is no caller that skips the check, including the client, and including local callers. MCP has no special path.

Rejected: role checks on agent calls only, with client endpoints left human-trusted. That rebuilds the second door D1 removed — an agent that can reach the client's configuration endpoint would bypass its own permissions.

### D5 — Offline behaviour — superseded by D15

Recorded for history. D5 split offline behaviour along a structural line: cached reads, queued `data` writes, no offline `configuration` writes, with every write carrying the version it was based on. D13 replaced versioned writes with mutations, and D15 moved the line from structural to security. The surviving parts of D5 are:

- the client holds a cache so the dashboard stays viewable and interactive without a live service
- queued writes replay after reconnecting, and are enforced against the caller's role like any other write
- the user is told when they are working offline

### D6 — Module cut

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

`contract` is React-free by construction, since card template components live in `card-templates`.

### D7 — Single user is a fact, not a constraint

The application currently has one human user. The design must not foreclose more, but must not implement multi-user support now. Accounts are already plural and roles are already a bundle, so more users is more rows, not a reshape.

### D8 — A card is placement-free

A card carries nothing about where it sits or how big it is: no position, no size. It does not carry style either — see D10.

A card is therefore portable: the same card can appear on a different dashboard without dragging a placement it no longer fits. This is what makes D9 possible.

`CONTEXT.md`'s card definition ended "and the card's position and style". That clause was deleted, not moved.

A card carries its own state — see D18.

### D9 — The dashboard is a document

A dashboard is an ordered set of card references plus a theme reference. It is grid-capable later: today the ordering is flat, and cell and span can be added without reshaping anything, because no card claims a placement.

The `arrangement` array leaves the schema; the dashboard document replaces it. More than one dashboard over one pool of cards falls out for free.

No new vocabulary term: `CONTEXT.md` already defines a dashboard as "an arrangement or ordering of cards on a page or display".

### D10 — "Style" is deleted; theme is the term

The concept — a named set of semantic tokens (palette, fonts, spacing, density) whose swap changes every colour and font at once — is already in `CONTEXT.md` as **theme**. "Style" stops being a term anywhere in the project.

A dashboard carries a theme _reference_; theme definitions live beside it in dashboard configuration.

### D11 — "Wiring" is deleted

A formatter belongs to a query against an integration. An integration is the connection; it exposes queries. Formatter, query, and integration reference travel together as one unit, and every unit belongs to exactly one card — nothing is shared between cards, deduplicated, or registered centrally.

The `wiring` array leaves the schema.

### D12 — An unauthenticated local caller resolves to a named role

Requests arriving with no credential resolve to a role named in dashboard configuration, `local`, shipped with write on everything except `roles`, and narrowable in Settings.

This is not a bypass of D4 — the local caller is a role like any other, resolved at the one enforcement point.

Consequence: D5's phrase "live authenticated caller" was wrong. The offline restriction is about the service being reachable, never about a credential.

### D13 — Mutations, not versions

Every write is a mutation — a named change ("mark this task complete") applied against current state — rather than a snapshot of the state the caller last saw.

Consequences:

- no `revision` field on anything; the concept is not introduced
- a queued write that replays minutes late applies correctly without a staleness check, because it describes a change rather than a result
- `version` leaves the schema. It was a schema version, and with one machine, no stored data belonging to anyone else, and no migration (D17), it earns nothing. It returns the day someone else's data has to survive an upgrade.

Rejected: per-record revisions, and HTTP `ETag`/`If-Match`. Both detect a conflict that mutations mostly do not create.

### D14 — The service exposes `read` and `apply`

Two operations. `read(scope)` returns state; `apply(mutations)` applies one or more mutations atomically.

Mutation types are a tagged union in `contract`, each tagged with the permission category it requires — so enforcement is one lookup rather than a check hand-written per endpoint, and the offline queue is a list of `apply` payloads rather than its own serialization format.

MCP tools and client actions are both mutation constructors.

Rejected: a wide RPC surface (`addCard`, `moveCard`, `setTheme`, …). Every action would carry its own endpoint and its own permission check, and the queue would need a second format.

### D15 — Offline: the line is security, not structure

Mutations in the security categories — `roles` and `integrations` — require a live service. Every other mutation queues offline and replays on reconnect.

A permission grant or an external authorization applied blind, minutes later, against state the caller never saw, is the one case where "apply against whatever you find" is the wrong answer. Adding a card and rearranging a dashboard are not that case.

Supersedes D5's structural split.

### D16 — Integrations and backup targets share one module

Both are user-authorized connections to an external service. The authorization flow and credential handoff is most of the code and is identical; they differ only in direction — one supplies data, one receives a copy.

Split later if a second concern actually diverges.

### D17 — Rewrite three modules; keep the rest

`contract`, `service`, and `mcp` are written fresh from this document. The client's card rendering, the built-in formatter implementations, and the Google Calendar integration are kept.

Measured: 2,568 lines across `src/`, ~1,700 non-test. The three modules are ~900 non-test lines, and the configuration type flows into every remaining file regardless, so an incremental migration touches the same files while leaving both doors open in the meantime — `requireAccess` in `src/mcp/operations.ts` alongside the new enforcement point, with each individual diff looking reasonable in review.

No back-compat shim, no deprecation window, no migration of a configuration file that exists on one machine. Pre-alpha and non-functional — there is nothing to keep working.

Documents are updated in the same pass, not staggered behind the code.

### D18 — A card carries its state; `source` is deleted

A card has state, updated by mutations whatever produced them. There is no separate entity for data a card draws from, and no term for one: `source` names an origin, and origin is invisible to the card, the formatter, and the card template by construction. `CONTEXT.md`'s **source** entry is deleted.

A card is: an id, a title, a card template reference, its state, and zero or more queries. Each query names an integration, the query to run against it, and the formatter that reshapes the result into the card template's schema.

```ts
type Card = {
  id: string;
  title: string;
  template: string;
  state: unknown;
  queries: Array<{
    integration: string;
    query: unknown;
    formatter: FormatterSpec;
  }>;
};
```

Zero queries, one, or several — to the same integration or to different ones. There is no card type and no manual-versus-connected distinction: every card accepts manual edits to its state whatever its queries, and a card with no queries is not a special case, just an empty array.

Card state is stored already fitting the card template's schema, so rendering is a straight read with no transform. This makes structural the rule `CONTEXT.md` already states: a card template displays properly formatted data and nothing more. A formatter is deterministic — same input, same output, no IO, nothing read from outside its input.

Consequence: two cards showing the same calendar each hold their own query and their own copy. Accepted — cards stay self-contained per D8, no entity has two writers, and no merge rule is needed anywhere.

### D19 — Roles are changed at source, not through the service

Decided 2026-09-01, while implementing #60.

No mutation reaches a role. `edit-role` and `remove-role` are deleted, and no `add-role` was ever written. Roles join card templates, built-in formatters, and packages: things a source change alters and the service cannot touch at any permission level.

Consequences:

- The `roles` permission category survives, read-only in effect. It still gates `read("roles")` and decides whether `read("all")` returns the role list.
- D3's no-widening guard is gone. It existed to stop a role-editing write from granting itself more; with no such write, the guard was dead code.
- Settings no longer edits roles. It keeps integrations, themes, and font scaling.
- Changing a role means editing the persisted dashboard configuration or the source default, then restarting. Accepted for one human user (D7).

This narrows D3. Roles still live in dashboard configuration, still carry no credential, and are still resolved on every call — only the editing path is withdrawn.

### D20 — Four permission levels: `none`, `read`, `edit`, `write`

Decided 2026-09-01, while implementing #60.

`none < read < edit < write`, ranked. `edit` changes something that already exists; `write` also creates and destroys. Each level implies every level below it.

The split falls on the mutation, not the category:

| Level   | Mutations                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| `edit`  | `patch-card-state`, `edit-card`, `edit-dashboard`, `edit-theme`, `edit-integration`, `set-font-scale`, `insert-card` |
| `write` | `add-card`, `remove-card`, `add-theme`, `remove-theme`, `add-integration`, `remove-integration`                      |

The point is `data: edit` and `cards: edit`: a caller may change what a card shows without being able to add or delete cards. F1's categories gave blast radius by subject; this gives it by verb.

Enforcement stays one lookup (D14). The mutation carries its category tag; the required level is read off the mutation type, and both are compared against the caller's bundle by rank.

Consequence: `edit-*` mutations no longer create what they cannot find. Creation needs an explicit `add-*`, which needs `write`. `add-theme` and `add-integration` exist because Settings manages both. Dashboards have no creation mutation yet.

### D21 — One dashboard; it is not a multi-dashboard product

Decided 2026-09-01.

The application ships with one dashboard and offers no way to create or delete one. There is no mutation for either, and none is planned.

The dashboard arrives in the default configuration, and every entrypoint hangs off it — Settings is reached from the dashboard, so "no dashboard exists" is not a state the UI has to handle.

`dashboardConfigurationSchema` holds `dashboard`, one object, not an array. D9's shape is unchanged: a dashboard is a document holding ordered card references plus a theme reference, and a card sits in one pool. The dashboard keeps its `id`, and `insert-card` still names it.

Consequence: `edit-dashboard` is the only dashboard mutation. It reorders card references and changes the theme reference.

### D22 — The service assembles a card template's component from a declarative composition tree, narrowing D2

Decided 2026-09-03.

D2 put card templates on the source-change side of the line: reviewed like any code change, never reachable through the service. This narrows that: the service gains one specific capability, assembling a card template's component source from agent input, gated by a permission level like any other mutation. Card templates are no longer categorically unreachable through the service — this one path exists, and nothing else about D2 changes (roles, built-in formatters, and packages stay untouched by the service).

The input is a declarative composition tree — `{component: string, props: Record<string, unknown>, children: Node[]}` — describing which `react-aria-components` to nest and with what props. The agent never writes code; it sends this tree. The service assembles real source from it: real imports, real JSX, using the component names and props as given.

Correctness comes from the library itself, not a hand-authored parallel schema. An earlier draft of this decision specified per-component prop/children schemas (mirroring `formatterSpecSchema`) — that was wrong and already caught: it duplicates what `react-aria-components`' own TypeScript types assert, and a hand-maintained duplicate drifts from the real types. The assembled file is checked by `tsc --noEmit` (already in `npm run check`) against the library's real types — that is the entire props/children correctness check. The input schema itself stays small and library-agnostic by construction: it describes tree shape, not any one library's vocabulary.

Scope: **static trees only.** A tree of `{component, props, children}` cannot express local state or callbacks — it has no way to represent `useDragAndDrop`/`useListData`-style hooks, or a stepper's `useState`. A card template that needs those (drag-and-drop, the `SteppedListCard` pattern) stays hand-written source, outside this path, reviewed the ordinary way. Drag-and-drop is explicitly out of scope for the assembled path.

One mechanism, not two: whoever's editing a card template's source — hand-written or assembled — is real `react-aria-components` composition either way; a differently-run copy of this codebase is the same source code, not a second system with its own rules.

### D23 — A dashboard declares its component library and style vocabulary at initialization

Decided 2026-09-04.

A dashboard is built against one presentational library — shadcn/ui today — named once, when the dashboard is initialized, alongside the rest of the starting dashboard configuration (D9). This is a source/init-time declaration, not a mutation: nothing in the service surface changes which library a dashboard renders through, the same way nothing in the service surface changes a role (D19).

The declared library fixes what a theme (D10) can say. `add-theme`/`edit-theme` (`presentation`, D14/F1) pick values from the library's own vocabulary — its CSS variables, its utility classes — never arbitrary CSS. A theme's settings are a selection within the declared library, not a stylesheet.

Card templates (D22) draw their presentational classes from the same declared library. `react-aria-components` stays the structural layer D22 assembles from; the library governs how the assembled markup looks, not what it's built from.

Rationale: the same reasoning as D22's correctness argument, applied to styling instead of structure. Letting a mutation (or a card template) introduce CSS ad hoc would mean re-deriving what "in bounds" means per call. Naming one library once and constraining every later styling choice to its vocabulary keeps that vocabulary checkable and reviewable, the way `tsc --noEmit` checks D22's composition trees against `react-aria-components`' real types.

### D24 — A running dashboard serves its own card templates as a shadcn registry

Decided 2026-09-04.

Each dashboard's own server (`src/server`) serves its wired-in card templates (D22) as a shadcn-compatible registry (https://ui.shadcn.com/docs/registry/mcp): an index at `/r/registry.json`, each template's built payload at `/r/<name>.json`. Any shadcn-aware client — including one connected over `shadcn mcp` — can search, view, and add a template from a running dashboard the same way it would from shadcn's own registry.

The registry is per-dashboard, not per-repo: it's generated by the server process at request time from `includedCardTemplates` (`src/client/cards/index.ts`), the same map that decides which templates are real. A directory scan was rejected — the templates directory also holds a view component, an index module, tests, and in-flight `__assemble-*` files from a concurrent `assemble-card-template` call; scanning it would surface those as items. `includedCardTemplates` is the one place that already answers "which templates are real," so the registry reads that, not the filesystem.

Several templates share one source file (`display.tsx`). Because a registry item's file content is the whole file it names, `cardTemplateSourceFiles` (sibling export next to `includedCardTemplates`) maps each template to the file it actually lives in, so `table`, `list`, `calendar`, and `chart` all resolve correctly instead of a wrong `<name>.tsx` guess.

The index lists items without file content (metadata only: name, type, dependencies); each item's own `/r/<name>.json` inlines the real source as `content`. `dependencies` and `registryDependencies` are derived from the template's own imports (`react-aria-components`; `@/components/ui/<name>` for shadcn/ui primitives) rather than hand-maintained, so they can't drift from the source that actually ships.

Rationale: the registry only needed to answer "what can a client search, view, and add from this dashboard" — not also host arbitrary write/download. Discovery plus `add` closes the loop shadcn's own CLI expects; nothing further was built. Deriving everything (which templates exist, what file they're in, what they depend on) from data the codebase already maintains for other reasons is the same locality argument as D23: one source of truth, checkable, no second list to keep in sync by hand.

---

## Frontier

The questions this session opened, and where each landed. All settled.

### F1 — Permission categories — SETTLED

Five categories. `data` and `cards` are the shipped keys, unchanged; `configuration` is split three ways, because granting a role is a security change and adding an integration is not.

| Category       | Owns                                                         |
| -------------- | ------------------------------------------------------------ |
| `data`         | Card state                                                   |
| `cards`        | Cards, including their queries and the formatter inside each |
| `presentation` | Dashboards, themes, font scaling                             |
| `integrations` | Integrations                                                 |
| `roles`        | Roles                                                        |

Values are uniform across every category — see D20 for the levels. `roles` is not special-cased in the type; D19 makes it read-only in effect, because no mutation reaches a role.

`data: edit` ticks a task. `cards: write` adds, removes, retitles, or re-templates a card. Different blast radius, different key.

Every writable thing in dashboard configuration maps to exactly one key.

### F2 — What the unauthenticated local caller may do — SETTLED

See D12.

### F3 — Mutation list — SETTLED as a way of working

There is no upfront list. Mutation types are defined in `contract` as each one is needed, tagged with the permission category it requires so `service` enforces with one lookup (D14).

Decisions to make while writing them:

- which mutations `mcp` exposes as tools, decided as the tools are written

### F4 — Version and staleness contract — SETTLED

See D13. No version, no staleness contract.

### F5 — Integration boundary — SETTLED

See D16.

### F6 — Card and card template shape — SETTLED

Settled by D8, D10, D11, and D18. A card is an id, a title, a card template reference, its state, and zero or more queries.

### F7 — Documentation targets — SETTLED, DONE

See D17. Both documents change in one pass with the rewrite.

**Done — both documents were updated in `cd8e98e` (#65). The list below is the
work that was carried out, kept as a record of what changed and why. It is not
outstanding.**

`ARCHITECTURE.md`

- line 7 — the MCP module is named as the interface an agent changes the dashboard through; the service is the interface and MCP is one peer over it (D1)
- lines 22–25 — the module map lists four modules; the cut is seven (D6)
- lines 40–47 — the rendering path has a card naming a source and a formatter mapping at render; state is stored pre-formatted and a formatter runs on the way in (D18)
- line 51 — "mutates cards, wiring, and arrangement"; `wiring` and `arrangement` are both deleted (D9, D11)
- line 53 — three permission categories; there are five (F1)

`CONTEXT.md`

- **card** carries "position and style"; it carries state and queries instead (D8, D18)
- **source** and **wiring** are deleted as terms (D11, D18)
- **style** overlaps **theme**; theme is the term (D10)
- **formatter** describes a render-time mapping; a formatter belongs to one of a card's queries, is deterministic, and runs on the way in (D11, D18)
- **dashboard** needs the document shape: ordered card references plus a theme reference (D9)
- `role`, `account`, `mutation`, and `query` need entries (D2, D13, D18)

### F8 — Where a card's data lives — SETTLED

See D18.
