# Dashboard Architecture

## Authority

This document is the authoritative source for the dashboard architecture. It supersedes conflicting architecture statements in every other repository document. Other documents may specify product requirements, but they must not redefine the architecture established here.

## Central principle

The standalone dashboard MCP module provides the interface through which an agent can change any or all parts of a dashboard in response to user prompts.

The dashboard is not one fixed object or universal data model. Its structure, data relationships, cards, code, presentation, and integrations may change when the agent implements the user's request.

## Dashboard configuration

Dashboard configuration is the persistent part of a dashboard — what remains when the data flowing through it changes.

## Dashboard

A dashboard specifies the arrangement or ordering of cards on a page or display.

## Card template

A card template is the reusable unit: a UI component paired with a JSON schema describing the input data the component displays. The component can render the contents of any data that fits the schema.

A card template is self-contained and whole-widget in grain — a calendar, an Eisenhower plot, a weather widget — not a layout atom. Card templates compose into other card templates.

By convention, a card template's schema keys name **how a value is displayed**, not what it means in a source domain: `COL_HEADER`, `LIST_ITEMS`, and so on. This is what lets source data be wired into an existing template without writing code — a formatter maps source fields onto display-role keys. A card template's schema may be empty, for a template that takes no input data.

A card template is responsible only for displaying properly formatted data. It does not extract, remove, or reformat source data.

## Card

A card is a card template in use on a dashboard: an id, a title, a reference to a card template, a data source, a formatter, and the card's position and style.

Moving a card, restyling it, or changing its inputs changes the card, never the card template. One card template backs any number of cards.

## Agent responsibility

In response to user prompts, the agent may create or change dashboard structure and card arrangement; cards — their template, data source, formatter, position, and style; dashboard data and data relationships; presentation, settings, and integrations; and any other part of the dashboard needed to fulfill the request.

Sensitive data handling inside an agent-created card is outside this project's scope. Repository content must never expose sensitive field names or values.
