# Context

`ARCHITECTURE.md` is authoritative for architecture. These terms must be interpreted consistently with it.

## Glossary

### Dashboard

The page or display that specifies the arrangement or ordering of panels.

### Panel

An independent display unit composed of a UI and a JSON Schema. The UI can render properly formatted data that fits the schema. The panel only displays data; it does not extract or reformat source data.

### Formatter

Code separate from a panel that extracts or reformats source data into the form described by the panel's JSON Schema. A formatter remains separate even when only one panel uses it.

### Panel wiring

The agent-created connection between source data, formatter code, a panel's JSON Schema, and the panel UI.

### Dashboard configuration

Persistent configuration for integrations, the selected UI theme, font scaling, agent permissions, panels, panel wiring, and panel arrangement. It does not define one universal model for panel data or code.

### Settings

The user interface through which a user directly manages integrations, the selected UI theme, font scaling, and agent permissions without interacting with an agent. Settings does not edit panels, formatter code, panel wiring, or panel arrangement.

### Agent permissions

User-controlled dashboard configuration that determines what dashboard information and artifacts an agent may inspect or change. The user manages these permissions through Settings.

### Dashboard MCP

The interface through which an agent creates or changes any or all parts of the dashboard in response to a user prompt, including dashboard configuration, panels, schemas, formatter code, data wiring, arrangement, data, presentation, and integrations. Its access is governed by agent permissions.

### High-impact item

An action or piece of information important enough to receive stronger prominence on a particular dashboard.

### Theme

A set of presentational settings applied to UI components. A theme does not own or control dashboard presentation.

### External service integration

An optional connection that supplies data or behavior to a dashboard.
