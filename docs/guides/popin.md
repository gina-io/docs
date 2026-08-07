---
title: Popins and Dialogs
sidebar_label: Popins and Dialogs
sidebar_position: 3.9
description: Open server-rendered content in a native dialog with one attribute — AJAX loading, hover and idle preloading, partial swaps that preserve dialog chrome, modal and non-modal modes, loading states, and the gina.popin API.
level: intermediate
prereqs:
  - '[Views](/guides/views)'
  - '[Forms and Validation](/guides/forms-and-validation)'
keywords:
  - node.js modal dialog
  - server rendered modal
  - ajax dialog node.js
  - html dialog element
  - popin
---

# Popins and dialogs

A **popin** is server-rendered content shown in a native `<dialog>` element. You
mark a trigger with one attribute, and Gina fetches the content, injects it,
opens the dialog, and manages focus, loading state and teardown.

The content is a normal route rendering normal templates — the server stays the
source of truth, the markup is what a designer edits, and nothing is duplicated
client-side.

:::caution The attribute you may have seen is the old one
`data-gina-popin-name` and `data-gina-popin-url` are **deprecated**. They still
work — Gina maps them onto the current path — but each emits a one-time console
warning, and they behave differently in ways that matter. The current attributes
are `data-gina-dialog` and `data-gina-dialog-src`. See
[Migrating from the legacy attributes](#migrating-from-the-legacy-attributes).
:::

---

## Quick start

**In-page dialog** — the content is already in the document:

```html
<a href="#terms" data-gina-dialog="terms">Read the terms</a>

<dialog id="terms">
  <button class="gina-popin-close">Close</button>
  <h2>Terms</h2>
  <p>…</p>
</dialog>
```

**AJAX dialog** — the content comes from a route:

```html
<a href="/terms" data-gina-dialog="terms" data-gina-dialog-src="/terms">
  Read the terms
</a>
```

The `href` is a real URL, so the link keeps working without JavaScript, in a new
tab, and for crawlers — Gina intercepts the plain left-click only. Close controls
are any element carrying the `gina-popin-close` class.

**No bundle code is required.** The declarative `data-gina-dialog` API boots
itself once the framework has loaded.

## How an open works

```mermaid
sequenceDiagram
    participant U as User
    participant P as gina/popin
    participant C as Preload cache
    participant S as Server
    U->>P: hover or focus the trigger
    P->>S: warm GET (default, same-origin)
    S-->>C: cache a 2xx non-JSON body
    U->>P: click the trigger
    P->>C: warm entry for this URL?
    alt cached
        C-->>P: body — no request, opens immediately
    else still in flight
        C-->>P: adopt the running fetch (no second GET)
    else cold
        P->>S: GET the source URL
        S-->>P: rendered HTML
    end
    P->>P: inject content, re-create external scripts
    P->>U: open the dialog, move focus
```

## Attribute reference

Two families, and the distinction matters: some attributes **you author**, and
some **Gina writes** for you to style or inspect. Never author the second group.

### Attributes you author

| Attribute | Value | Effect |
|---|---|---|
| `data-gina-dialog` | the dialog's `id` | Opens that dialog |
| `data-gina-dialog-src` | a URL | Loads the content from that route over AJAX. Valid on its own, without `data-gina-dialog` |
| `data-gina-dialog-target` | a CSS selector | **Partial swap** — replaces only that region's contents, so chrome (close button, header, footer) and its bindings survive |
| `data-gina-dialog-modal` | `"false"` ⇒ non-modal; **any** other value ⇒ modal | Overrides the modal mode for this trigger |
| `data-gina-dialog-preload` | `"false"` or `"eager"` | Controls prefetching — see [Preloading](#preloading) |

On an `<a>`, the `href` doubles as the source URL, so `data-gina-dialog-src` can
be omitted (an empty `href`, `#`, or one starting with `#` is ignored).

:::warning These two parse `"false"` differently
`data-gina-dialog-modal` compares **case-sensitively** — `"False"` is not
`"false"`, so it gives you a *modal* dialog. `data-gina-dialog-preload` matches
case-**insensitively**, deliberately, so a templated `"False"` cannot silently
fail open. Same-looking value, opposite parsing.
:::

### Attributes Gina writes

| Attribute | Where | Meaning |
|---|---|---|
| `data-gina-loading` | trigger | A request from this control is in flight |
| `data-gina-popin-loading` | container, then the dialog | This popin is filling |
| `data-gina-popin-is-link` | links inside popin content | Engine bookkeeping for link handling |
| `data-gina-popin-inert` | sibling dialogs | Marks the `inert` Gina added, so teardown removes only its own |
| `data-gina-popin-scroll-lock` | `<body>` | Non-modal scroll lock |

Gina also manages `aria-haspopup`, `aria-controls`, `aria-labelledby`,
`aria-disabled`, `inert` and `tabindex` on the elements it owns.

## Modal and non-modal

A modal dialog (`showModal()`) gets Escape-to-close, an inert background, a focus
trap and a scroll block from the browser. A non-modal dialog (`show()`) gets none
of those, so Gina supplies equivalents itself.

**Declarative `data-gina-dialog` triggers default to non-modal.** The mode is
resolved by this precedence, highest first:

1. A **legacy trigger** (`data-gina-popin-name`) — always modal, not overridable.
2. `data-gina-dialog-modal` on the trigger.
3. The per-popin constructor option, `new Popin({ modal: true })`.
4. `gina.config.popin.modal`.
5. The framework default — **non-modal**.

:::caution `gina.config.popin.modal` is not a global switch
That chain runs only for declarative triggers. Anything that opens a popin
another way — a legacy trigger, or a direct `gina.popin.open(name)` call —
**falls back to modal** regardless of your config. Setting it to `false` will not
make a programmatic open non-modal.
:::

Because non-modal is the default for the current API, opening a popin does **not**
close the one it supersedes: both stay in the page. Gina inerts sibling dialogs
that are still open so only the topmost is reachable, leaves already-closed ones
alone (the browser hides those anyway), and on teardown restores exactly what it
marked — an `inert` your own code set is never claimed or cleared.

## Preloading

**Hover and focus preloading is on by default** for every trigger with a source
URL. A click that arrives while a warm request is still running **adopts** it
instead of issuing a second identical `GET`.

| Value | Behaviour |
|---|---|
| *(absent)* | Warm on hover or focus — the default |
| `"eager"` | Also warm at browser idle after `window` load, one trigger at a time. Skipped when the browser signals Save-Data |
| `"false"` | Never warm, and never serve from a cache entry — a **hard always-refetch guarantee** |

Warm requests are same-origin only, sent without credentials, and only a `2xx`
non-JSON body is cached — a JSON redirect envelope is left for the click to
handle. A cache entry never outlives the open it warmed, so reopening fetches
current content rather than replaying the previous body.

:::warning Preload turns a hover into a GET
The warm is a real request, fired before any click. If a URL has server-side
effects, mark its trigger `data-gina-dialog-preload="false"`. This matters most
for triggers built at render time from stored data — those are invisible to a
template grep, so an audit that only reads templates will miss them.
:::

## Partial swaps

`data-gina-dialog-target` takes a CSS selector. Gina parses the response, finds
the matching region in it, and replaces **the contents of** the matching element
in the open dialog — the element itself survives, which is what preserves chrome
and its event bindings.

Two behaviours to know:

- **A selector that matches nothing falls back to a full replace, silently.** A
  typo produces working-but-wrong output with no warning.
- **It applies to the current API only.** A legacy `data-gina-popin-name` trigger
  carrying `data-gina-dialog-target` does a full replace.

## What happens to the content

Injected popin content follows the same contract as any HTML inserted through
`innerHTML`:

- **External scripts and stylesheets are re-created** in `<head>`, with a dedup
  guard against the resources the host page already had, so a fragment may safely
  re-declare the page's bundles. This is why
  [client components](/guides/client-components) work inside popins with no
  rebinding. The guard is a snapshot taken when the popin is registered, so a
  resource added to the page *after* that point will be re-injected.
- **Inline scripts never execute.** Anything a popin needs must be a `src`-bearing
  script or already present on the page.
- **Closing tears down.** Injected scripts and stylesheets are removed, AJAX
  content is wiped, focus returns to the trigger, and components'
  `disconnectedCallback` fires. An in-page dialog keeps its authored content.
  Reopening an AJAX popin refetches.

### Forms inside popins

Form binding is **not automatic** — it happens when the popin was constructed
with a validator instance:

```js
new Popin({ name: 'signup', validator: gina.validator });
```

With one, each form in the content is bound through
[validation](/guides/forms-and-validation) and gains a `close` method. Because a
form in a modal popin lives inside a `showModal()` dialog — where everything
outside is inert — its validation live region stays inside the form itself.

## Loading state

While a popin loads, the trigger carries a loading attribute and the container
carries `data-gina-popin-loading`. They sit on different elements and answer
different questions: the container one says *this popin is filling*, the trigger
one says *this control is busy*.

:::caution Match the value, not the presence
The trigger attribute is never removed — it is set back to `"false"`. Style
`[data-gina-loading="true"]`; a bare `[data-gina-loading]` also matches a
released trigger and pins the busy style on permanently. Its name is
configurable through `gina.config.loadingAttribute`, so read that rather than
hard-coding the literal if your project renames it.
:::

Two more details worth knowing:

- `data-gina-popin-loading` lands on the shared container for the first load, and
  on the dialog element for every load after the first open. Write CSS that
  covers both.
- An open served entirely from a warm cache issues no request, so it sets
  **neither** attribute. That is expected, not a bug — there is nothing to wait
  for.

Gina ships a default look (a `progress` cursor and an opacity pulse, the pulse
gated on `prefers-reduced-motion`) which you can replace entirely. For a popin
that should appear instantly and fill afterwards, construct it with
`preOpen: true` and optionally your own `loadingShell` markup.

## The `gina.popin` API

```js
gina.popin.open(name);              // opens MODAL — see the caution above
gina.popin.close(name);
gina.popin.load(name, url, options);
gina.popin.loadContent(html);       // inject content you already have
gina.popin.getActivePopin();        // the popin on top, or null
gina.popin.getPopinByName(name);
gina.popin.getPopinById(id);
gina.popin.destroy(name);
```

The registry is shared across every popin instance, so a form in one popin can
redirect into another. `gina.popin.activePopinId` and `gina.popin.$popins` expose
the live state.

`open()` throws if the name is unknown, `loadContent()` throws if the popin is
not open, and `load()` throws if the name cannot be resolved — so guard calls
whose names come from data. With two non-modal popins open, `getActivePopin()`
returns whichever it reaches first; prefer looking a popin up by name when you
know which one you mean.

**Events**, observable with `gina.popin.on('<event>', handler)`:

| Event | Payload |
|---|---|
| `ready` | the popin |
| `open` | the popin |
| `close` | the popin |
| `loaded` | the response body |
| `error` | `{ status, error }` |
| `destroy` | `{ name, id }` |

:::note Three names that do not fire
`success`, `progress` and `click` exist in the internal event registry but no
current code path delivers them — do not subscribe to them expecting callbacks.
Use `loaded` for content arrival and `error` for failures.
:::

## Migrating from the legacy attributes

| Legacy (deprecated) | Current |
|---|---|
| `data-gina-popin-name="X"` | `data-gina-dialog="X"` |
| `data-gina-popin-url="/u"` | `data-gina-dialog-src="/u"` |

Both still work and emit one console warning each per page. Three differences
matter when you convert:

- **Modal mode.** A legacy trigger is always modal; the current API defaults to
  non-modal. If you rely on modal behaviour, add `data-gina-dialog-modal` when
  you convert.
- **Partial swaps.** `data-gina-dialog-target` has no effect on a legacy trigger.
- **Setup.** Legacy triggers only work when your code constructs the matching
  popin (`new Popin({ name: '…' })`); the current API needs no setup at all.

Only those two attributes are deprecated. `data-gina-popin-loading` and
`data-gina-popin-is-link` are written by Gina, are current, and never warn — keep
styling `data-gina-popin-loading` as you do today.

:::caution Picking this up needs a bundle rebuild
The popin plugin ships inside each bundle's browser bundle. Upgrading the
framework updates the server half only — run `gina bundle:build` for plugin
changes to reach your pages.
:::

## Related

- [Client-Side Components](/guides/client-components) — widgets that upgrade
  automatically inside popin content and tear down on close.
- [SPA Navigation](/guides/client-navigation) — whole-page fragment navigation;
  it defers to popin-owned triggers and closes an open popin on swap.
- [Forms and Validation](/guides/forms-and-validation) — the submit lifecycle and
  loading state that forms inside popins participate in.
- [Controllers](/guides/controller) — `renderWithoutLayout()` for the layoutless
  fragments popins usually load.
