# Vocabulary

Terms this project uses, and what each one means. Nothing else defines these; if you find a term defined elsewhere, that is a bug to fix rather than a second opinion.

## Dashboard

An arrangement or ordering of cards on a page or display.

## Card template

The reusable unit: a UI component paired with a JSON schema describing the input data the component displays. The component can render any data that fits the schema.

A card template is whole-widget in grain — a calendar, an Eisenhower plot, a weather widget — not a layout atom. Card templates compose into other card templates.

A card template displays properly formatted data and nothing more. It does not extract, remove, or reformat source data.

## Display-role key

A key in a card template's schema. Display-role keys name **how a value is displayed**, not what it means in a source domain: `COL_HEADER`, `LIST_ITEMS`, and so on.

This is what lets source data reach a template without new code — a formatter maps source fields onto display-role keys. A card template's schema may be empty, for a template that takes no input data.

## Card

A card template in use on a dashboard: an id, a title, a reference to a card template, a data source, a formatter, and the card's position and style.

Moving a card, restyling it, or changing its inputs changes the card, never the card template. One card template backs any number of cards.

## Dashboard configuration

The persistent part of a dashboard — what remains when the data flowing through it changes.

## Source

Named input data a card draws from. A source is data as it arrives, before any formatting.

## Formatter

The mapping from a source's shape onto a card template's display-role keys. A formatter is `"identity"` when the source already matches the schema, a fixed function bundled with the application shell, or a declarative mapping spec — field renaming, fallback chains, defaults, and array mapping.

## Wiring

The connection between a source, a formatter, and a card. Wiring is what an agent creates and maintains so that formatted data fits its card template's schema.

## Integration

An optional, user-authorized connection to an external service that a source draws from.

## Theme

A set of presentational settings applied to UI components — color, typography, spacing, density. A theme cannot execute code, read dashboard data, or alter behavior.

## Settings

The interface through which a user directly manages integrations, themes, font scaling, and agent permissions without involving an agent.
