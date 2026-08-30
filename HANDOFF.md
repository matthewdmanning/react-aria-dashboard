# Handoff

Two open questions left over from the 2026-08-30 repository overhaul. Delete this file once both are answered.

## Wayfinder map tickets need a decision

The map's _Decisions so far_ records only the research ticket. Several decisions were made in conversation and never written onto the tickets they answer:

- Vocabulary — card template vs card, display-role keys, empty schemas. Answers part of **Define the component contract (#48)**.
- The five card templates were renamed, not reconsidered. Answers part of **Fate of the five existing card variants (#52)**.
- **Two separate MCP servers**, one for card design and one for everyday adjustments. This reads like the whole answer to **Split design mode from everyday data updates (#49)**, and it may reshape the map.

Question: update those tickets with what was decided, close them as answered, or delete them?

## The product spec still describes the old model

`agent-docs/personal-dashboard-product-spec.md` L25 and L33 say agents create or change cards' "UIs, JSON Schemas, formatter code", and that cards are "composed of a UI and JSON Schema".

That contradicts the card template model in `ARCHITECTURE.md` and `CONTEXT.md`. It is the exact question **Bound or reverse the panels-as-data decision (#46)** exists to settle, so it was left alone rather than decided by editing prose.
