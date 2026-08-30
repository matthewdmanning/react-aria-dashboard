# Research: Chota CSS as a global stylesheet under React Aria Components

No existing `research/` or `docs/research/` convention was found in this repo, so this note
lives at `docs/agents/research/chota-styling.md` alongside the other `docs/agents/*.md` notes.

## 1. Package identity and version

- npm package name: **`chota`**
- Latest published version: **0.9.2** (published 2023-03-22)
  Source: npm registry metadata for the package.
  https://registry.npmjs.org/chota
- Package description: "a micro CSS framework" (~3kb minified+gzipped), 12-column grid,
  CSS-variable based theming, no preprocessor required.
  Source: https://registry.npmjs.org/chota
- Repository: https://github.com/jenil/chota
- Docs site / homepage: https://jenil.github.io/chota

No newer version has been published since 0.9.2 as of this research (npm registry
`dist-tags.latest` = 0.9.2).

## 2. Class-name conventions

Verified against the shipped stylesheet in the Chota GitHub repo:
https://github.com/jenil/chota/blob/master/dist/chota.css

### Buttons

- Base selector applies to **both** `.button` and bare native form-control tags:
  ```css
  .button,
  [type="button"],
  [type="reset"],
  [type="submit"],
  button { ... }
  ```
  i.e. every native `<button>` element gets Chota's button look automatically, with
  or without the `.button` class.
- Variants: `.button.primary`, `.button.secondary`, `.button.dark`, `.button.error`,
  `.button.success`
- Outline style: `.button.outline`, `.button.outline.primary`, etc.
- `.button.clear` (no background/border)
- `.button.icon`, `.button.icon-only`
- State pseudo-classes are layered on the same bare-tag selectors, e.g.:

  ```css
  .button:hover,
  [type="button"]:hover,
  [type="reset"]:hover,
  [type="submit"]:hover,
  button:hover {
    opacity: 0.8;
  }

  .button:active:not(:disabled),
  [type="button"]:active:not(:disabled),
  ... button:active:not(:disabled) {
    transform: scale(0.98);
  }
  ```

  Source: https://github.com/jenil/chota/blob/master/dist/chota.css

### Cards

- `.card` — container box (border, padding, radius)
- `.card p:last-child` — removes bottom margin on the last paragraph
- `.card header > *` — spacing for direct children of a `<header>` inside a card
  Source: https://github.com/jenil/chota/blob/master/dist/chota.css

### Grid / layout

- `.container` — max-width centered wrapper
- `.row`, `.row.reverse` — flex row
- `.col` — flexible (equal-width) column
- `.col-1` through `.col-12` — fixed-width columns (12-col grid)
- `.col-1-md` … `.col-12-md` — medium breakpoint (≥900px) variants
- `.col-1-lg` … `.col-12-lg` — large breakpoint (≥1200px) variants
  Source: https://github.com/jenil/chota/blob/master/dist/chota.css,
  grid docs at https://jenil.github.io/chota/#grid

### Form controls

Chota does **not** require a class on inputs — it targets bare native elements directly:

```css
input:not([type="checkbox"], [type="radio"], [type="submit"],
          [type="color"], [type="button"], [type="reset"]) { ... }
select { ... }
textarea { ... }
[type="checkbox"], [type="radio"] { ... }
[type="range"], progress { ... }
```

Focus state, also on the bare tag:

```css
input:not(...):focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 1px var(--color-primary);
}
```

Source: https://github.com/jenil/chota/blob/master/dist/chota.css

## 3. Conflict risk with React Aria Components (RAC)

**Chota styles bare native tags (`button`, `input`, `select`, `textarea`), not just
classes**, and it does so using native pseudo-classes (`:hover`, `:focus`, `:active`,
`:disabled`) rather than data-attributes. This is the crux of the risk:

- RAC's `Button`, `Input`, etc. render as real native `<button>`, `<input>`, `<select>`
  elements under the hood (confirmed on RAC's own Button docs — the rendered output is a
  native `<button>`). Source: https://react-aria.adobe.com/Button
- Because Chota's selectors target the bare tag with no class required, **every RAC
  element will pick up Chota's default look automatically** — this is actually the point
  of using it as a global stylesheet (free baseline styling), but it also means Chota's
  rules are always "in the running" for these elements, not opt-in per component.
- RAC applies its own state as data-attributes — `data-hovered`, `data-pressed`,
  `data-focused`, `data-selected`, `data-disabled`, `data-entering`, `data-exiting`, etc.
  — documented at https://react-aria.adobe.com/styling.html. RAC's own docs describe
  these as deliberately **similar to, and complementary with, native pseudo-classes**:
  > "React Aria includes states such as `data-hovered` and `data-pressed` which are
  > similar to CSS pseudo classes such as `:hover` and `:active`, but work consistently
  > between mouse, touch, and keyboard modalities."
  > (https://react-aria.adobe.com/styling.html)
  > Native `:hover`/`:focus`/`:active` continue to fire on the underlying DOM node in
  > parallel with RAC's data-attributes — RAC does not remove or suppress them.
- **Specificity is a near-tie, so load order decides the winner.** Chota's bare-tag
  pseudo-class rules (e.g. `button:hover`) and a hypothetical RAC-consumer rule like
  `button[data-hovered]` are both single-selector, single-class-equivalent specificity
  (0,1,1). Whichever stylesheet is later in the cascade wins on a tie. Concretely:
  - If Chota's global stylesheet is loaded/declared **after** the panel-authored CSS
    that targets `[data-hovered]`/`[data-pressed]`/`[data-focused]`, Chota's `:hover`/
    `:active`/`:focus` rules will win and silently override the RAC-driven look for
    plain, unclassed elements.
  - If Chota loads **first**, panel CSS targeting the data-attributes wins as expected,
    and Chota mainly supplies unstyled-baseline defaults (color, padding, radius) that
    RAC/panel rules layer on top of.
  - Either way, a panel author who forgets to add an explicit override for hover/focus/
    active/disabled states may end up with a mix of Chota's default look and RAC's
    intended visual state, because Chota is not scoped and does not check for `.button`/
    a class — it matches the bare tag.
- Practical implication for this repo's plan (global Chota stylesheet, agents use Chota
  class names directly in JSX): load Chota's stylesheet **before** any panel/RAC-specific
  CSS in the cascade (e.g. import it at the top of the app entry, before component CSS),
  and treat Chota's bare-tag rules as the "reset/base layer" only. Any panel that needs
  RAC's `data-hovered`/`data-pressed`/`data-focused`/`data-disabled` states to be visually
  distinct from Chota's own `:hover`/`:active`/`:focus`/`:disabled` styling must add its
  own CSS keyed to those data-attributes with at least equal specificity, or Chota's
  pseudo-class rules can visually clobber it on ties depending on final import order.

## Sources

- https://registry.npmjs.org/chota (npm registry metadata: name, version, description)
- https://github.com/jenil/chota (repository)
- https://jenil.github.io/chota (docs site)
- https://github.com/jenil/chota/blob/master/dist/chota.css (shipped CSS, class/selector reference)
- https://react-aria.adobe.com/Button (RAC Button renders native `<button>`)
- https://react-aria.adobe.com/styling.html (RAC data-attribute states and their relationship to native pseudo-classes)
