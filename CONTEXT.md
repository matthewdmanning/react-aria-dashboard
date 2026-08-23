# Context

## Glossary

### Personal dashboard

A local-first application that helps a person prioritize, focus on, and manage their chosen information and actions. It is not limited to job searching, studying, or any other single domain. It remains usable from its locally persisted state when network services are unavailable.

### High-impact item

An action or piece of information important enough to receive stronger prominence on the dashboard. The dashboard helps the user identify these items and reduce competition from lower-value information.

### Dashboard payload

The validated JSON document supplied to the dashboard. Domain-specific sections can evolve, while shared application behavior consumes the payload through one validation and state-application boundary.

### Canonical JSON file

The single local JSON document that stores the dashboard's persisted state. It is the source of truth for the application and a directly usable context artifact for local agents.

### Record schema

A user-defined description of the fields and field types allowed in a record collection. It lets each person model the tasks and information important to them without treating study plans, calendar entries, or focus tasks as universal data types.

### Semantic role

An optional meaning assigned to a schema field so the dashboard can interpret custom records consistently. First-release roles include impact, deadline or urgency, and status or completion; field names remain user-defined.

### Record collection

A set of records governed by one record schema. It exists independently of panels and may supply the same records to multiple panels.

### Custom panel

A configured view of a record collection using a built-in display type. Multiple panels may present the same records differently, and an edit to a shared record is reflected in every panel that uses it.

### Built-in display type

A dashboard rendering pattern implemented by the application, such as a list, table, cards, calendar, checklist, or chart. First-release custom panels select from these types rather than providing executable UI code.

### Agent-driven customization

A capability in which an AI agent proposes a record schema, panel configuration, or record change. First-release panel proposals use only built-in display types.

### Agent session

A multi-step conversation in which an agent may ask questions, inspect dashboard context allowed by its configured permissions, and refine a proposed change. Its ability to inspect or change dashboard state is governed by agent permissions in Settings.

### Agent permissions

The user-controlled Settings rules that determine which dashboard state an agent may inspect or change. An agent action that changes a connected third-party service always requires explicit approval.

### Theme

A locally stored, declarative visual package that controls the dashboard's presentation through design tokens and approved component variants. It cannot execute code, access data, or alter prioritization. Themes work offline after installation; an online catalog may be used only to discover and install additional themes.

### Cloud backup

An optional encrypted remote copy of dashboard settings and content used for backup and restore. It is not required to use the local dashboard, does not replace the canonical local JSON file, and does not synchronize edits between devices.

### Backup target

A cloud provider or other user-selected remote location that holds an optional cloud backup. The dashboard treats each provider as a storage target rather than as part of the dashboard's core data model.

### Local agent integration

An optional, user-controlled connection from the dashboard to a local AI tool or model. It receives only explicitly selected dashboard context and does not require cloud access.

### External service sync

An optional, user-authorized pull from a third-party service, such as Google Calendar, that updates a dashboard section. The last successfully synced data remains available locally; failed or unavailable syncs do not prevent other dashboard use.

### Pull-only integration

An external service sync that reads service data into the dashboard but does not create, edit, or delete data in that service.
