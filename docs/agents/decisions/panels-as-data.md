> **Read permission required.** Agents must obtain explicit user permission before reading this file, regardless of permission settings. Historical record only — not authoritative. See [`ARCHITECTURE.md`](../../../ARCHITECTURE.md).

# Why panels became pure data

PR #41 shipped a draft-staged pipeline (`draft-schema` → `draft-component` → `draft-formatter` → `add-panel`/`edit-panel`) that let an agent submit raw JSON-schema-string, TSX-string, and TS-string content, governed after the fact by regex/AST checks (`panel-validation.ts`, `forbiddenSource`). Investigation during the following architecture review found the pipeline was entirely dead code: `readPanelPackage` had zero callers outside its own test, and `App.tsx` hardcoded `panelDefinitions`/`sources`/`formatters` as literals — nothing dynamically loaded a committed panel.

Grilling with the project owner reframed the goal:

- This is a one-off template product — each user re-runs the panel-authoring process themselves, not a one-time build. Kind-authoring (a genuinely new visual shape) happens weekly early, tapering off; arrangement changes weekly-to-monthly; data changes daily. The recurring pain point is kind-authoring, not data or arrangement.
- The design space doesn't need to be infinite — this isn't enterprise software.
- The central requirement is structural, not procedural: an agent must never be able to hand-roll a raw HTML primitive or an off-token color. Regex/AST validation after the fact has known bypasses (indirect `style={x}`, template-literal colors, non-denylisted tags, string-concatenated imports); a closed vocabulary makes the violation unrepresentable instead of usually-rejected.
- Two data shapes cover every real panel need: mechanical data (a declarative mapping from a source, e.g. Google Calendar) and judgment data (an agent or human writes schema-matching data directly — a prioritized task list — no formatter beyond identity).

Given that, panels became config entries referencing a fixed, code-defined kind registry; formatters became identity, a named built-in, or a declarative spec; the entire code-authoring path — draft pipeline, on-disk panel package, regex/AST governance — was deleted rather than fixed. Kind-authoring (the one place code still changes) moved to ordinary source edits, governed by normal code review; lint tooling for it was explicitly deferred as unnecessary for a one-off project.

Single source of truth: this file is not updated as the architecture evolves further. `ARCHITECTURE.md` is. If this file's account of why becomes actively misleading, prefer deleting it over correcting it.
