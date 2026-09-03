# Research: React Aria hooks (`react-aria` / `react-stately`) as the card-authoring substrate

Follows the convention of `docs/agents/research/chota-styling.md` — every claim carries a
URL or a repo/`node_modules` file path.

**Headline question:** does building dashboard cards on React Aria's _hooks_ rather than the
`react-aria-components` (RAC) wrappers meaningfully shrink the TypeScript needed per component?

**Answer: no — for cards shaped like the ones this repo has, hooks make each component
_larger_.** Hooks only pay off for collection-shaped cards whose required DOM structure RAC's
component tree cannot express. Detail below.

## 0. Dependency facts (verified in this working tree)

- `package.json` declares exactly one React Aria dependency: `"react-aria-components": "^1.20.0"`.
  Source: `package.json` (dependencies block).
- `react-aria` and `react-stately` are **already present in `node_modules`** as transitive
  dependencies of RAC — nothing needs installing to start importing hooks today.
  `npm ls react-aria react-stately` output:
  ```
  react-aria-dashboard@0.0.0 C:\GitHub\react-aria-dashboard
  └─┬ react-aria-components@1.20.0
    ├─┬ react-aria@3.51.0
    │ └── react-stately@3.49.0 deduped
    └── react-stately@3.49.0
  ```
- **Installed versions: `react-aria@3.51.0`, `react-stately@3.49.0`.**
  Source: `node_modules/react-aria/package.json`, `node_modules/react-stately/package.json`.
- RAC pins both **exactly**, not with a range:
  `"react-aria": "3.51.0"`, `"react-stately": "3.49.0"`.
  Source: `node_modules/react-aria-components/package.json` (dependencies block).
- Consequence: importing from `react-aria` today is an **undeclared dependency**. It resolves
  because npm hoists it, but nothing in `package.json` guarantees it stays. Because RAC pins
  exact versions, a RAC bump silently moves the hook API underneath us. If hooks are adopted,
  both must be added to `package.json` explicitly, and kept version-locked to whatever RAC pins
  — a mismatch installs two copies of the state/context modules, which breaks context identity
  (see §4).
- The individual `@react-aria/*` and `@react-stately/*` scoped packages are **not** installed as
  separate directories — `react-aria@3.51.0` ships them bundled into its own `dist/`.
  Verified: `ls node_modules/@react-aria` and `ls node_modules/@react-stately` return nothing,
  while `node_modules/react-aria/dist/exports/` contains the built modules. This matters for any
  doc example that says `import {...} from '@react-aria/overlays'` — that import path does not
  resolve in this tree (see §4, PortalProvider).
- **`src/` currently imports React Aria zero times.** `grep -rn "react-aria" src/` returns no
  matches. RAC is a declared-but-unused dependency, so this decision is still fully open — there
  is no migration cost on either path.

## 1. The hook surface, mapped onto dashboard-card needs

The public hook list below was read from the **installed type definitions**, not from docs:
`node_modules/react-aria/dist/types/exports/index.d.ts` and
`node_modules/react-stately/dist/types/exports/index.d.ts`.

A dashboard card, as this repo uses the term, renders data and _sometimes_ has internal
navigation or selection state (`src/client/cards/display.tsx` is 103 lines; `message.tsx` is 12).

| Area                | Hooks that exist                                                                                                                                                                        | Relevance to a card                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focus management    | `useFocusRing`, `useFocusVisible`, `useFocusWithin`, `useFocusManager`, `useFocusable`                                                                                                  | **Low.** `useFocusRing` returns `isFocusVisible` so you can key styling off a prop instead of the CSS `:focus-visible` pseudo-class. The prototype already does this in plain CSS. Real value only when styling in JS. |
| Keyboard navigation | Not a standalone hook — arrow/Home/End/typeahead behaviour is baked into the _collection_ hooks (`useListBox`, `useGridList`, `useMenu`, `useTable`, `useTabList`)                      | **High, but only for collections.** This is the single biggest thing you cannot reasonably hand-roll. It is equally available via RAC.                                                                                 |
| Selection           | `useListState` / `useSingleSelectListState` (stately) expose a `SelectionManager`: `toggleSelection`, `replaceSelection`, `extendSelection`, `selectAll`, `canSelectItem`, `isDisabled` | **Medium.** Only if a card has multi-select with shift-range and Ctrl+A. Source: https://react-aria.adobe.com/ListBox/useListBox.html                                                                                  |
| Collections         | `useListState`, `useTreeState`, `useTableState`, `useCollection`, plus data helpers `useListData`, `useAsyncList`, `useTreeData`                                                        | **Medium.** `useListState` returns `{collection, disabledKeys, selectionManager}`. Source: https://react-aria.adobe.com/useListState.html                                                                              |
| Overlays            | `useOverlayTrigger`, `usePopover`, `useModalOverlay`, `useDialog`, `useOverlayPosition`, `useInteractOutside`, plus `Overlay` + `DismissButton` components                              | **Low for cards, high cost.** See §4 — this is where hooks bite hardest.                                                                                                                                               |
| Drag & drop         | `useDrag`, `useDrop`, `useDraggableCollection`, `useDraggableItem`, `useDroppableCollection`, `useDropIndicator` + `useDraggableCollectionState`                                        | **Speculative.** Would matter for reordering cards on the dashboard; nothing in `src/client/` needs it today.                                                                                                          |
| Live announcements  | `announce` / `clearAnnouncer` / `destroyAnnouncer` — **not in the public export list**                                                                                                  | **Effectively unavailable.** See §2.                                                                                                                                                                                   |

Two absences worth naming, because they define the benchmark result:

- **There is no stepper / cursor / paginator hook.** Nothing in either export list advances a
  bounded index. The nearest thing is `useNumberFieldState`, and it is the wrong shape — its
  `NumberFieldState` is a _text input_ state carrying `inputValue: string`, `validate(value)`,
  `commit()`, `Intl.NumberFormatOptions` formatting, and it extends `FormValidationState`. It does
  expose `canIncrement` / `canDecrement` against `minValue`/`maxValue`, but you would be dragging
  a form-validation object and an unrendered input string along to get two booleans.
  Source: `node_modules/react-stately/dist/types/numberfield/useNumberFieldState.d.ts`.
- **`announce()` is not public API.** It exists in the installed tree only at
  `node_modules/react-aria/dist/types/exports/private/live-announcer/LiveAnnouncer.d.ts`, whose
  entire contents are:
  ```ts
  export {
    announce,
    clearAnnouncer,
    destroyAnnouncer,
  } from "../../../src/live-announcer/LiveAnnouncer";
  ```
  It resolves through the `"./*"` wildcard in the package `exports` map (keys are exactly
  `'.'`, `'./i18n'`, `'./i18n/*'`, `'./package.json'`, `'./*'` — source:
  `node_modules/react-aria/package.json`), i.e. as
  `react-aria/private/live-announcer/LiveAnnouncer`. The path segment is literally `private`, and
  the symbol is absent from `exports/index.d.ts`. React Aria uses `LiveAnnouncer` for its _own_
  internals — the ComboBox write-up describes adding two visually-hidden `aria-live` regions to
  patch VoiceOver announcement gaps.
  Source: https://react-aria.adobe.com/blog/building-a-combobox

## 2. Benchmark: `examples/StudyPlansCard.prototype.tsx`

The file is 380 lines, but most of it is not the component. Measured against
`examples/StudyPlansCard.prototype.tsx`:

| Region                            | Lines            | Note                                    |
| --------------------------------- | ---------------- | --------------------------------------- |
| Header comment                    | 1–7              | —                                       |
| Mock data + `StudyItem` interface | 12–72            | Stands in for backend data              |
| **`StudyPlansCard` component**    | **78–174 (~97)** | The thing under test                    |
| `formatDateForDisplay`            | 180–188          | `Intl` via `toLocaleDateString`         |
| CSS string + injection            | 195–377          | ~180 lines, irrelevant to this question |

**Imports today: one.** `import { Button } from 'react-aria-components'` (line 10), plus React.

### What each hand-rolled part would cost as hooks

- **The two nav buttons** (lines 119–126, 140–147). Today: `<Button isDisabled onPress
aria-label className>`. Hooks: `useButton(props, ref)` returns `buttonProps` to spread on a
  native `<button>` you render yourself — the canonical example is six lines of component plus
  two imports. Source: https://react-aria.adobe.com/Button/useButton.html
  `useButton` does **not** give you focus-ring state; that is a separate `useFocusRing()` call
  merged in with `mergeProps` — visible in Adobe's own draggable-listbox example, which merges
  `optionProps`, `dragProps` and `focusProps`.
  Source: https://react-aria.adobe.com/useDraggableCollection.html
  **Net: you write a ~10-line `Button` component to get back what one import already gave you.**
- **The live region** (lines 128–138). Today: a `<div role="status" aria-live="polite"
aria-atomic="true">` wrapping a `<time>` — 6 lines of plain JSX, zero imports. Hooks: there is
  no supported replacement (§1). `announce()` sits behind a `private/` subpath. And it would be
  the _wrong_ tool anyway: `announce()` is for transient messages, whereas the date here is
  persistent visible content that must stay in the DOM. **The hand-rolled version is both
  shorter and more correct. No change.**
- **The stepper state** (lines 84–108): `allDates`, `useState(todayIndex)`, `handlePrevious`,
  `handleNext`, two boundary booleans — ~20 lines, zero imports. Hooks: nothing fits (§1).
  `useNumberFieldState` drags in `inputValue`/`validate`/`commit`/`FormValidationState`.
  `useTabListState` or `useSingleSelectListState` would supply a selected key plus arrow-key
  navigation, but they require building a `Collection` from `<Item>` children and they impose
  tab/listbox ARIA roles — wrong semantics for a date stepper, and _more_ code.
  **No change, or a regression.**
- **`<nav aria-label="Study plan date navigation">`** (line 117). `useLandmark` exists, but a
  native `<nav>` with an accessible name already _is_ an ARIA landmark. Rung 4 of the ladder:
  the platform covers it. **No change.**
- **`:focus-visible` styling** (CSS lines 248–251). `useFocusRing` gives `isFocusVisible` as a
  boolean, which matters when styling in JS. This repo styles in CSS. **No change.**

### Sketch of the hook-based equivalent

```tsx
import { useRef } from "react";
import { mergeProps, useButton, useFocusRing } from "react-aria";
import type { AriaButtonProps } from "react-aria";

// You must now own the Button that RAC previously supplied.
function Button(props: AriaButtonProps & { className?: string }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const { buttonProps } = useButton(props, ref);
  const { isFocusVisible, focusProps } = useFocusRing();
  return (
    <button
      {...mergeProps(buttonProps, focusProps)}
      ref={ref}
      className={`${props.className ?? ""} ${isFocusVisible ? "focus-visible" : ""}`}
    >
      {props.children}
    </button>
  );
}

export function StudyPlansCard(): React.ReactElement {
  // UNCHANGED from the prototype — no hook supplies a bounded index cursor.
  const allDates = Object.keys(STUDY_PLAN_DATA).sort();
  const [dateIndex, setDateIndex] = useState(allDates.indexOf("2026-08-29"));
  const currentDate = allDates[dateIndex];

  return (
    <section className="study-plans-card">
      <header>
        <h2>Study Plans</h2>
      </header>
      <nav aria-label="Study plan date navigation">
        <Button
          isDisabled={dateIndex === 0}
          onPress={() => setDateIndex(dateIndex - 1)}
          aria-label="Previous day"
        >
          ← Previous
        </Button>

        {/* UNCHANGED — no public hook replaces this. */}
        <div role="status" aria-live="polite" aria-atomic="true">
          <time dateTime={currentDate}>
            {formatDateForDisplay(currentDate)}
          </time>
        </div>

        <Button
          isDisabled={dateIndex === allDates.length - 1}
          onPress={() => setDateIndex(dateIndex + 1)}
          aria-label="Next day"
        >
          Next →
        </Button>
      </nav>
      {/* study items + footer: plain JSX, identical either way */}
    </section>
  );
}
```

### Result

|                          | RAC (today)  | Hooks                             |
| ------------------------ | ------------ | --------------------------------- |
| Component body           | ~97 lines    | ~97 lines (unchanged)             |
| Extra `Button` component | 0            | ~14 lines                         |
| Imports from React Aria  | 1 (`Button`) | 3 values + 1 type, from 1 package |
| Refs to manage by hand   | 0            | 1 per button                      |
| Behaviour gained         | —            | none                              |

**The hook version is ~15 lines longer and imports more, for identical output.** Every part of
this card that hooks _could_ replace is already covered by a native element (`<button>`,
`<nav>`, `<time>`, `aria-live`) or by `useState`; and the one genuinely hard thing hooks are
good at — collection keyboard navigation — this card does not have.

## 3. When wrappers beat hooks, and when wrappers obstruct

### Wrappers (RAC) win

- **Anything with a collection.** `<ListBox>` / `<GridList>` / `<Menu>` / `<Table>` give arrow
  keys, Home/End, typeahead, shift-range and Ctrl+A selection for a handful of lines. The hook
  equivalent is a `useListState` + `useListBox` + `useOption` triple where you hand-render the
  `<ul>`, iterate `[...state.collection]`, and wire an `Option` sub-component with its own ref —
  visible in Adobe's own listbox example.
  Source: https://react-aria.adobe.com/useDraggableCollection.html
- **Anything with an overlay.** The hook path for a popover requires assembling
  `useOverlayTriggerState` + `useOverlayTrigger` + `usePopover` + `<Overlay>` + an underlay div +
  **two** `<DismissButton>`s (one before and one after the content, for iOS VoiceOver).
  Source: https://react-aria.adobe.com/Popover/usePopover.html
- **The default case.** RAC components render the same native elements underneath, so styling
  reaches them either way — RAC's `Button` renders a real `<button>`.
  Source: https://react-aria.adobe.com/Button (and see `docs/agents/research/chota-styling.md`,
  which relies on exactly this fact for the Chota global-stylesheet plan).

### Where wrappers obstruct

- **Render props force a function child.** RAC's styling API passes state into `className` and
  `children` as callbacks, so a component that wants to be a plain declarative tree ends up
  wrapping children in arrow functions. Adobe ships a `composeTailwindRenderProps` helper
  precisely because composing a caller's `className` with the render-prop form is fiddly.
  Source: https://react-aria.adobe.com/Toast
- **Slot/context coupling.** Some RAC children only work in the right parent, addressed by a
  `slot` prop — e.g. `<Text slot="description">` inside `ListBoxItem`, `<Button slot="close">`
  inside `Toast`, `<MyCheckbox slot="selection">` inside `GridListItem`. A component lifted out
  of its expected parent loses behaviour silently, because the context simply isn't there.
  Sources: https://react-aria.adobe.com/ListBox, https://react-aria.adobe.com/Toast,
  https://react-aria.adobe.com/customization
- **Unstable surfaces.** Toast is exported as `UNSTABLE_ToastRegion` / `UNSTABLE_Toast` /
  `UNSTABLE_ToastQueue`, and the portal escape hatch is `UNSAFE_PortalProvider`. If a card needs
  either, the wrapper API is not settled.
  Sources: https://react-aria.adobe.com/Toast, https://react-aria.adobe.com/PortalProvider
- **Required DOM structure.** RAC dictates the element tree it renders. When a card needs markup
  RAC won't emit (a wrapping element between list and item, a different tag), hooks are the only
  way out — this is the real reason to reach for them, not line count.

**Important: it is not either/or.** RAC exports a context per component, and `useContextProps`
merges context-supplied props with local ones (local wins), so a single hook-built component can
be dropped into an otherwise-RAC tree:

```tsx
import {
  CheckboxContext,
  type CheckboxProps,
} from "react-aria-components/Checkbox";
import { useContextProps } from "react-aria-components/slots";
import { useToggleState } from "react-stately/useToggleState";
import { useCheckbox } from "react-aria/useCheckbox";

const MyCheckbox = React.forwardRef((props: CheckboxProps, ref) => {
  const [mergedProps, mergedRef] = useContextProps(props, ref, CheckboxContext);
  const state = useToggleState(mergedProps);
  const { inputProps } = useCheckbox(mergedProps, state, mergedRef);
  return <input {...inputProps} ref={mergedRef} />;
});
```

Source: https://react-aria.adobe.com/customization — "You can reuse React Aria Components in
custom patterns or replace parts of existing components without a full rebuild." The right
policy is therefore **RAC by default, hooks per-component as an escape hatch**, not a substrate
choice made once for the whole dashboard.

## 4. Constraints hooks impose on composition

- **Every hook needs a ref you own.** `useButton(props, ref)`, `useCheckbox(props, state, ref)`,
  `useListBox(props, state, ref)` all take a ref as a positional argument. A hook-built component
  that wants to be composable must therefore `forwardRef` and reconcile the caller's ref with its
  own — `useContextProps` returns a `mergedRef` for this, and `useObjectRef` exists for the same
  reason. Sources: https://react-aria.adobe.com/Button/useButton.html,
  https://react-aria.adobe.com/customization
- **Locale context is required.** Anything doing formatting or direction-aware key handling reads
  locale from context (`useLocale`, `useDateFormatter`, `useCollator`, `useFilter` are all in the
  `react-aria` export list). Adobe's `I18nProvider` must be an ancestor, or RTL/locale behaviour
  falls back to a default.
- **The collection owner is the parent, not the item.** `useListState` builds the collection and
  owns the single `SelectionManager`; each item hook (`useOption`, `useGridListItem`,
  `useMenuItem`) is passed `state` explicitly as an argument. Consequences: (a) items must be
  direct products of the parent's `[...state.collection]` iteration — you cannot drop an arbitrary
  card in the middle of a list and have it participate in keyboard navigation; (b) you cannot
  nest one collection component inside another's item and expect two independent selection
  managers to coexist without arrow-key conflicts, since the outer collection's key handlers are
  on the container. Source: https://react-aria.adobe.com/ListBox/useListBox.html
- **Overlays escape the DOM tree.** `usePopover` content is wrapped in `<Overlay>`, which portals
  to `document.body` by default. So a popover opened from inside a card is _not_ a DOM descendant
  of that card: CSS scoped to `.study-plans-card` will not reach it, `overflow: hidden` on the
  card will not clip it, and z-index stacking is resolved at the body level.
  Source: https://react-aria.adobe.com/Popover/usePopover.html
  The fix is `UNSAFE_PortalProvider getContainer={() => container.current}`, and note the docs
  import it as `from '@react-aria/overlays'` — **that specifier does not resolve in this tree**,
  since no `node_modules/@react-aria/` directory exists (§0). It would have to be imported from
  the bundled `react-aria` instead. Source: https://react-aria.adobe.com/PortalProvider
- **What breaks on unexpected nesting.** Two concrete failure modes:
  1. A RAC child rendered outside its expected parent finds no context and silently degrades —
     `<Button slot="close">` outside a `Toast`, `<MyCheckbox slot="selection">` outside a
     `GridListItem`. Source: https://react-aria.adobe.com/customization
  2. Duplicate package instances break context identity. Because RAC pins `react-aria@3.51.0` and
     `react-stately@3.49.0` **exactly** (§0), adding a differently-ranged `"react-aria"` to
     `package.json` can install a second copy; the contexts are then distinct objects and
     `useContextProps` finds nothing. Any adoption must pin to RAC's exact versions.

## Sources

- `package.json` — declares `react-aria-components@^1.20.0`, and no `react-aria`/`react-stately`
- `npm ls react-aria react-stately` — both present transitively via RAC
- `node_modules/react-aria/package.json` — version 3.51.0; `exports` map (`.`, `./i18n`,
  `./i18n/*`, `./package.json`, `./*`)
- `node_modules/react-stately/package.json` — version 3.49.0
- `node_modules/react-aria-components/package.json` — exact pins on both
- `node_modules/react-aria/dist/types/exports/index.d.ts` — public hook list
- `node_modules/react-stately/dist/types/exports/index.d.ts` — public state-hook list
- `node_modules/react-aria/dist/types/exports/private/live-announcer/LiveAnnouncer.d.ts` —
  `announce` only under a `private/` subpath
- `node_modules/react-stately/dist/types/numberfield/useNumberFieldState.d.ts` —
  `NumberFieldState` shape
- `examples/StudyPlansCard.prototype.tsx` — the benchmark component
- `src/` — no `react-aria` imports anywhere (`grep -rn "react-aria" src/`)
- `docs/agents/research/chota-styling.md` — prior note; RAC renders native elements
- https://react-aria.adobe.com/Button/useButton.html — `useButton` usage and signature
- https://react-aria.adobe.com/Button — RAC `Button` renders a native `<button>`
- https://react-aria.adobe.com/useDraggableCollection.html — `useListState`/`useListBox`/
  `useOption`/`useFocusRing`/`mergeProps` composition
- https://react-aria.adobe.com/ListBox/useListBox.html — `useListState` props, `SelectionManager`
- https://react-aria.adobe.com/useListState.html — `ListState` return shape
- https://react-aria.adobe.com/ListBox — `Text slot="label"` / `slot="description"`
- https://react-aria.adobe.com/customization — `useContextProps`, per-component contexts, slots
- https://react-aria.adobe.com/Popover/usePopover.html — `usePopover`, `Overlay`, `DismissButton`
- https://react-aria.adobe.com/Modal/useModalOverlay.html — `useOverlayTrigger`
- https://react-aria.adobe.com/PortalProvider — `UNSAFE_PortalProvider`
- https://react-aria.adobe.com/Toast — `UNSTABLE_*` toast exports, render props, `slot="close"`
- https://react-aria.adobe.com/blog/building-a-combobox — `LiveAnnouncer` as internal machinery
