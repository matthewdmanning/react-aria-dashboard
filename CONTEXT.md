# Vocabulary

Terms this project uses, and what each one means. Nothing else defines these; if you find a term defined elsewhere, that is a bug to fix rather than a second opinion.

## Dashboard

An arrangement or ordering of cards on a page or display.

Concretely, a dashboard is a document: an ordered set of card references plus a theme reference. It holds no card contents of its own — a card lives in one pool and any number of dashboards may reference it.

## Card template

The reusable unit: a UI component paired with a JSON schema describing the input data the component displays. The component can render any data that fits the schema.

A card template is whole-widget in grain — a calendar, an Eisenhower plot, a weather widget — not a layout atom. Card templates compose into other card templates.

A card template displays properly formatted data and nothing more. It does not extract, remove, or reformat data.

## Display-role key

A key in a card template's schema. Display-role keys name **how a value is displayed**, not what it means in an external domain: `COL_HEADER`, `LIST_ITEMS`, and so on.

This is what lets external data reach a template without new code — a formatter maps incoming fields onto display-role keys. A card template's schema may be empty, for a template that takes no input data.

## Card

A card template in use: an id, a title, a reference to a card template, its state, and zero or more queries.

A card carries no position, no size, and no theme of its own. Placement belongs to the dashboard that references it, and appearance belongs to the theme that dashboard names. Retitling a card, editing its state, or changing its queries changes the card, never the card template. One card template backs any number of cards.

## State

The data a card currently displays, stored already fitting its card template's schema. Rendering is a straight read with no transform.

State is changed by mutations, whatever produced them — a user edit or a query result reshaped by its formatter. A card accepts manual edits to its state whatever its queries.

## Query

A request a card makes against an integration, bundled with the formatter that reshapes the result. A query names the integration, the query to run against it, and that formatter.

A query belongs to exactly one card. Nothing is shared between cards, deduplicated, or registered centrally. Two cards showing the same calendar each hold their own query and their own copy of the result.

## Formatter

The mapping from a query result's shape onto a card template's display-role keys. A formatter belongs to one query and runs on the way in, before the result is stored as state — never at render time.

A formatter is deterministic: same input, same output, no IO, nothing read from outside its input. It is `"identity"` when the result already matches the schema, a fixed function bundled with the application shell, or a declarative mapping spec — field renaming, fallback chains, defaults, and array mapping.

## Mutation

A named change applied against current state — "mark this task complete" — rather than a snapshot of the state the caller last saw.

Every write is a mutation. Because a mutation describes a change rather than a result, one that replays minutes late still applies correctly, with no version or staleness check. Each mutation type is tagged with the permission category it requires, and requires either `edit` or `write` in that category depending on whether it changes something that exists or creates and destroys.

## Dashboard configuration

The persistent part of a dashboard — what remains when the data flowing through it changes. It holds cards, dashboards, themes, integrations, roles, and font scale.

## Integration

An optional, user-authorized connection to an external service. An integration exposes queries that cards draw from, and may also serve as a backup target.

## Theme

A named set of presentational settings applied to UI components — colour, typography, spacing, density. A theme cannot execute code, read dashboard data, or alter behavior.

Theme definitions live in dashboard configuration; a dashboard references one.

## Role

A named bundle of permissions, assigned to an account. A role carries no credential and lives in dashboard configuration. No mutation reaches a role: changing one is a source change, like adding a card template.

A bundle covers five categories — `data`, `cards`, `presentation`, `integrations`, `roles` — each holding `none`, `read`, `edit`, or `write`. The levels are ranked and each implies the ones below it: `edit` changes something that already exists, and `write` also creates and deletes.

## Account

The identity a caller presents. An account holds a credential and the name of the role assigned to it, and lives in the auth store, outside dashboard data.

A caller arriving with no credential resolves to the role named `local`.

## Settings

The interface through which a user directly manages integrations, themes, and font scaling without involving an agent. Roles are not edited here — they are a source change.
