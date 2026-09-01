# Architecture decisions — grilling session, 2026-08-31

## Status

**Work in progress. Deliberately ahead of the codebase.**

This document does not need to agree with the code, with `ARCHITECTURE.md`, with `CONTEXT.md`, or with any other document, and a disagreement is not a bug to fix here. Those documents describe what exists; this one describes what was decided.

**When planning, this document is the authoritative source of truth.** Where it conflicts with anything else, it wins, and the other document is the one that has not caught up yet.

Every item is settled. Nothing here is open.

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
- changes to card templates, built-in formatters, and packages are source changes, reviewed like any other code change, and are not reachable through the service at any permission level

### D3 — Roles live in dashboard configuration; accounts live in the auth store

Split at the credential line:

- **Roles** — name plus permission bundle — live in dashboard configuration and are edited through Settings. They carry no credential.
- **Accounts** — credential plus assigned role name — live in the auth store, outside dashboard data.

The service resolves account, then role, then permissions, on every call.

This satisfies both product-spec constraints that were pulling apart: Settings remains the interface for changing agent permissions, and credentials and tokens stay out of dashboard data.

The escalation guard follows: a write to dashboard configuration may not widen the role bundle held by the caller making it. This is an enforcement rule in `service`, not a shape in `contract`.

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

`CONTEXT.md`'s card definition currently ends "and the card's position and style" — that clause is deleted, not moved.

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

Values are uniform `none | read | write` across every category; write implies read and includes delete. `roles` is not special-cased in the type — D3's no-widening rule guards it in `service`.

`data: write` ticks a task. `cards: write` adds, removes, retitles, or re-templates a card. Different blast radius, different key.

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
