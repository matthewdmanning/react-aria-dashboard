# Personal Dashboard — Product Specification

## Status

Draft product specification based only on the decisions recorded in this conversation. Items without a decision are explicitly marked **Open**.

## Product

A general personal dashboard for viewing and managing the user's chosen information and actions. It is not limited to job searches, study plans, or any other specific task domain.

The product is a one-page local web app whose application package is ready to run in a deployment environment. It does not have a separate landing or focus page. Building or provisioning cloud infrastructure is out of scope.

The implementation is not constrained to a single static HTML file. A broader web framework or supporting toolchain may be used when needed to meet the product requirements.

## Technical direction

- The frontend uses React, TypeScript, and Vite.
- React Aria Components provides accessible interaction behavior for complex controls.
- Native HTML and CSS are used where they are sufficient.
- CSS custom properties support the declarative theme system.
- A small Node.js backend provides atomic JSON persistence, Google integrations, external-access authentication, and MCP tools.
- The product does not use a database.

## Goals

- Help the user prioritize and focus on the actions and information most relevant now.
- Persist user changes through a backend rather than only in browser memory.
- Keep the dashboard usable locally without requiring network access.
- Keep content available as a local JSON file, so local AI tools can use it as context.
- Allow optional connections to external services and optional cloud storage.
- Support included and third-party themes.
- Allow the creation of custom panels backed by shared record collections and user-defined record schemas.
- Allow interaction with AI agents through dashboard state-management tools, including an MCP interface.

## First-release completion boundary

The first release is not complete until it includes all of the following:

- Local persistence through the backend and canonical JSON file.
- Custom panels using the built-in display types.
- Agent interaction governed by permissions configured in Settings.
- Agentic tools, including an MCP interface, for inspecting and updating dashboard state.
- A pull-only Google Calendar integration with locally retained data.
- Encrypted Google Drive backup and restore.
- Included and third-party themes that work offline after installation.
- A deployment-ready application package that does not require cloud infrastructure or provisioning work to be part of this product.
- Authentication when the dashboard is externally accessible; local-only access does not require authentication.

These capabilities may be built sequentially. Each capability must be tested and previewed before work proceeds to the next build stage.

## Local data and backend

- The local JSON file is the persisted source of dashboard content and settings.
- A database is out of scope because the product is too small to need one.
- The backend updates the local JSON file when the user approves changes.
- The dashboard remains usable from its locally persisted state when external services or network access are unavailable.
- The local JSON file remains directly usable as context for local AI tools.

## Access security

- Local-only dashboard access does not require authentication.
- The dashboard must require authentication when it is externally accessible.
- The exact authentication mechanism and external-access configuration remain open.

## Panels, record collections, and schemas

- The existing dashboard panel design is visual and interaction inspiration only; it is not the product's permanent domain model.
- Records exist in collections independently of panels.
- Each record collection uses a user-defined record schema.
- Users configure a record schema's fields and field types to model the tasks and information important to them.
- A record schema may assign fields the semantic roles impact, deadline or urgency, and status or completion while retaining user-defined field names.
- A panel is a configured view of a record collection, and multiple panels may present the same records through different built-in display types.
- Editing a shared record updates every panel that presents it.
- Built-in display types and themes use semantic roles consistently for emphasis, sorting, filtering, and clutter reduction.
- First-release custom panels are limited to built-in display types.
- The built-in display types are: list, table, cards, calendar, checklist, and chart.
- Arbitrary custom HTML or JavaScript supplied through a schema or panel configuration is not specified for the first release.

## Agent interaction

- The product offers an option to interact with AI agents.
- The project includes agentic tools for inspecting and updating dashboard state.
- The agentic tool surface includes an MCP interface.
- Agent access to dashboard state is governed by permissions configured in Settings.
- An agent session may be multi-step: the agent can ask follow-up questions before proposing a panel or content change.
- Agent-driven customization is constrained to first-release built-in display types.
- Any agent action that changes a connected third-party service requires explicit user approval before it is applied.
- Local AI tools are supported as an intended use case; cloud AI is optional.

## User experience

- The interface must feel pleasing and calming rather than dense or demanding.
- The visual hierarchy must draw attention to current action items and relevant information.
- Prioritization and focus are core product outcomes, not presentation-only enhancements.
- The dashboard is one page; prioritization happens within the dashboard rather than on a separate landing or focus page.
- Default components, included themes, and dashboard functionality must provide ways to emphasize high-impact items and reduce visual clutter.
- Custom panels and themes must be able to preserve a clear distinction between important items and supporting information.
- The primary interaction modes are tablet touch and mouse input.
- Interactive targets, gestures, menus, selection, reordering, and editing must work with both touch and mouse.
- Keyboard and assistive-technology access remain required accessibility basics.
- Detailed interaction, layout, visual, responsive, and accessibility requirements remain open.

## External-service integrations

- External services are optional, user-authorized pull sources.
- Google Calendar is an example integration: it may refresh its dashboard section when online.
- The dashboard retains the last successfully synced data locally.
- A failed or unavailable sync does not prevent use of other dashboard features.
- First-release integrations are pull-only: they do not create, edit, or delete data in the external service.

## Themes

- Included and third-party themes are supported.
- Themes are declarative UI packages made from design tokens and approved component and emphasis variants.
- Themes may change color, typography, spacing, density, and high-impact treatments.
- Themes cannot execute code, access dashboard data, or alter prioritization behavior.
- Installed themes are stored locally and work offline after installation.
- An online catalog may be used to discover and install additional themes.

## Optional cloud backup and restore

- The app may back up both settings and content to optional cloud storage and restore them later.
- The local JSON file remains the source of truth and the dashboard does not require a cloud backup to operate.
- The cloud backup target is user-defined rather than a fixed repository or provider.
- Google Drive is the first cloud storage target.
- Dropbox and other storage targets are planned for a later release.
- Uploaded dashboard data must be encrypted.
- First-release cloud storage does not synchronize edits between devices or reconcile concurrent changes.

## Existing implementation reference

The current static HTML dashboard and its JSON input are reference material for the new product, not the product scope itself:

- [Current HTML reference](C:\Users\mattm\Documents\Codex\2026-08-20\referenced-chatgpt-conversation-this-is-an\outputs\job-search-progress.html)
- [Current JSON reference](C:\Users\mattm\Documents\Codex\2026-08-20\referenced-chatgpt-conversation-this-is-an\outputs\study-plans.json)
- [Interface prototype](C:\Users\mattm\Documents\Codex\2026-08-22\new-chat\outputs\personal-dashboard.html)

The existing template currently validates JSON before applying it to in-memory dashboard state. Its study-plan, calendar, and focus data shapes are specific to that template. The new product must support user-defined record schemas, shared record collections, and configurable panel views; no replacement JSON structure has been decided in this specification.

## Open decisions

- The exact local backend implementation and API.
- The exact canonical JSON structure for record schemas, record collections, panel configuration, settings, and backup metadata.
- The supported field-type catalog, validation rules, and display-type compatibility rules.
- The exact value models and precedence rules for impact, urgency, and completion.
- The encryption method, key ownership, recovery, and decryption behavior for cloud copies.
- Google Drive authorization and sync behavior.
- Cloud backup creation, retention, restoration, and overwrite behavior.
- The MCP tool contract, transport, lifecycle, and detailed permission categories.
- The authentication mechanism and external-access configuration.
- Deployment packaging, runtime configuration, and production-readiness acceptance criteria.
- Third-party theme discovery, review, installation, and removal behavior.
- The detailed interface and accessibility requirements beyond the prototype.

## Explicitly deferred

- Dropbox and other cloud storage integrations.
- External-service write-back.
- Arbitrary executable custom panel code.
- A database.
- Cloud infrastructure and provisioning.
