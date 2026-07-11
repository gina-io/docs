---
title: Client-Side Components
sidebar_label: Client Components
sidebar_position: 3.7
description: Build stateful client-side widgets as standards-based Web Components — zero dependencies, server-rendered markup, automatic upgrade in XHR-injected content, SEO-first.
level: intermediate
prereqs:
  - '[Views](/guides/views)'
  - '[Custom elements (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)'
---

# Client-Side Components

Gina's answer for stateful client-side widgets is the **platform primitive**: [custom elements v1](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) — `customElements.define('x-widget', class extends HTMLElement { … })`. No framework dependency, no build tooling, no second rendering paradigm beside your server templates. What gina adds are the **integration seams**: authoring conventions, a reference component in every view scaffold, and guarantees about how components behave in gina-rendered and gina-injected content.

:::info
*New in 0.5.15* — the conventions, the scaffold reference component, and the e2e coverage ship with the framework. No framework runtime code is involved: components are plain platform features that gina's render pipeline passes through verbatim.
:::

Two long-standing pain points this retires:

1. **Widgets going dead in XHR-injected content.** Handler-bound code needs manual rebinding after a popin or AJAX swap replaces DOM. Custom elements don't: the browser upgrades them **automatically on insertion**, wherever the markup lands — including popin bodies. No rebind hook, no re-scan.
2. **No sanctioned non-framework answer for stateful widgets.** These conventions are that answer.

---

## The authoring model — HTML and JS stay separated

A component has two files, owned by two roles:

- **The markup is a template partial** (the *designer* surface). It lives in the bundle's template tree like any page fragment, and the server renders it as the element's **light DOM**. Regular engine tooling, regular stylesheets — and the content ships in the initial HTML.
- **The class is behavior-only** (the *developer* surface). It lives in `public/js/`, binds and enhances its own server-rendered subtree — listeners, state via `classList`/attributes/`textContent` — and holds **no markup strings**: no `innerHTML` template literals, no JS-built render trees.

Repeatable or dynamic markup comes from a server-rendered `<template>` **inside** the component's light DOM, cloned and filled by the class — or, for larger content, a server-rendered fragment fetched over XHR (the popin pattern). The markup source is always a file a designer edits.

### The reference component

`gina view:add` scaffolds a working example. The partial (`templates/html/includes/x-checklist.html`):

```html
<x-checklist data-x-checklist='{ "statusText": "%s of %s done" }'>
    <h2>Getting started checklist</h2>
    <p data-role="status" hidden></p>
    <ul>
        <li><label><input type="checkbox" checked> Scaffold your project and start the bundle</label></li>
        <li><label><input type="checkbox"> Add a route in <code>config/routing.json</code></label></li>
        <li><label><input type="checkbox"> Point it at a controller action</label></li>
        <li><label><input type="checkbox"> Read the <a href="https://gina.io/docs/">documentation</a></label></li>
    </ul>
    <template data-role="item">
        <li><label><input type="checkbox"> <span data-role="item-label"></span></label></li>
    </template>
    <form data-role="add" action="#" method="get">
        <input type="text" name="label" placeholder="Add a step" aria-label="New checklist item">
        <button type="submit">Add</button>
    </form>
</x-checklist>
```

Everything meaningful is server-rendered, semantic HTML — headings, list items, a real `<a href>` link. The `<template data-role="item">` is the component's only source of dynamic markup.

The class (`public/js/components/x-checklist.js`, abridged):

```js
class XChecklist extends HTMLElement {

    static get observedAttributes() {
        return ['collapsed'];
    }

    connectedCallback() {
        if (this._bound) { return; }        // re-fires when the element is moved
        this._bound = true;

        var config = {};
        try {
            config = JSON.parse(this.getAttribute('data-x-checklist') || '{}');
        } catch (err) {
            config = {};
        }
        this._statusText = config.statusText || '%s of %s done';

        this._list     = this.querySelector('ul');
        this._template = this.querySelector('template[data-role="item"]');
        // … bind change/submit listeners on the subtree, render the status line
    }

    attributeChangedCallback(name) {
        // data DOWN — react to attribute writes from outside
    }

    addItem(label) {
        // dynamic markup never comes from JS strings — clone the template
        var fragment = this._template.content.cloneNode(true);
        fragment.querySelector('[data-role="item-label"]').textContent = label;
        this._list.appendChild(fragment);
    }
}

customElements.define('x-checklist', XChecklist);
```

## Placement and loading

Definition files live in **`public/js/`** and are declared once in `config/templates.json`:

```jsonc
"javascripts": [
    "/handlers/main.js",
    "/js/components/x-checklist.js"
]
```

Files under `public/` are served plain. Do **not** put component definitions in `templates/handlers/` — handler files are wrapped in the framework's `onGinaReady` bootstrap at serve time, which defers your `customElements.define()` behind the framework-load poll (a needless flash of undefined content) and implies handler semantics the definition doesn't have.

**Timing rules:**

- **Define eagerly.** A component definition is a plain external script with no gina dependency — it can (and should) register at parse time. Upgrade is retroactive, so ordering against other scripts is soft.
- A handler that needs a component's API waits for it: `customElements.whenDefined('x-checklist').then(…)`.
- Gate `connectedCallback` work on gina readiness **only** when the component actually needs `gina.config` / `gina.session` / `gina.validator`. `window.__ginaWebroot` is set synchronously at parse time and is safe for URL building without any gate.

## SSR and hydration

The server template is the single source of markup; the class hydrates from it:

- **Attributes for scalars** — `collapsed`, counts, modes. Observe the reactive ones with `static observedAttributes`.
- **One JSON payload** via a component-owned `data-*` attribute (use your tag name as the key: `data-x-checklist='{ … }'`). The component parses it defensively; mind HTML attribute escaping when the JSON carries user content.
- **Slotted light-DOM content** for everything textual — it's just server-rendered HTML the class reads in place.
- **Declarative shadow DOM** (`<template shadowrootmode="open">`) is available for pre-styled non-content chrome — it's plain markup to the template engines — but see the SEO section before reaching for it. Imperative shadow roots with JS-built markup are out by convention.

Components own their attribute namespace — gina parses none of it. The `data-gina-*` prefix stays framework-owned; don't squat it.

## SEO and GEO come first

All meaningful content must be present in the **initial server-rendered HTML** as light DOM. Most AI/answer-engine crawlers fetch raw HTML and do **not** execute JavaScript, and classic crawlers that do still defer JS-rendered content. The authoring model above makes conformance the default; keep it that way:

- Custom tags are SEO-neutral — crawlers read the text content of unknown elements normally. Use **semantic HTML inside** the component: headings, lists, real `<a href>` links (never JS-only navigation).
- Keep rankable content **out of shadow roots** entirely — even declarative shadow DOM sits inside an inert `<template>` for any non-DSD-aware fetcher.
- A component's XHR is for **interactivity and live data only**, never for content that must rank or be quotable by answer engines.
- Structured data (JSON-LD) stays a server-template concern, unaffected by components.

The framework's e2e suite locks this contract for the reference component: its meaningful content is asserted present in the raw served HTML with no browser at all.

## Communicating between components

Use the platform's native unidirectional protocol — never a shared two-way-bound model:

- **Data DOWN via attributes.** `static observedAttributes` + `attributeChangedCallback` is the built-in inbound observer: anything that writes an attribute triggers the component's reaction.
- **Events UP via composed, bubbling `CustomEvent`.** Naming convention: `<tag>:<verb>` — e.g. `x-filters:changed` — payload in `detail`.

```mermaid
flowchart LR
    H[Page handler] -- "setAttribute(…)" --> A["&lt;x-filters&gt;"]
    A -- "CustomEvent x-filters:changed" --> D[document]
    D -- "listener in handler" --> H
    H -- "setAttribute / refresh()" --> B["&lt;x-results&gt;"]
    B -- "XHR: refetch its own server-rendered fragment" --> S[(Server)]
```

**Cross-fragment coordination** (fragment B reacts to fragment A): either B listens document-level for A's event directly — peer components stay decoupled — or a small page **handler** wires A's event to B's attribute or refresh call. Orchestration lives in the handler, which gina already has as a concept; handlers are also where gina-API reactions (popin/validator lifecycle) belong.

**Server-truth coordination** (B's content must reflect the server after A's action): B refetches its own server-rendered fragment on A's event. The server stays the single source of truth — no duplicated client model, and the result is SEO-consistent.

**"Bi-directional" is two unidirectional links** — each direction its own event-to-attribute wire. A shared two-way-bound observed model is the classic feedback-loop footgun (cycle guards, batching, digest problems); if a screen genuinely needs coordinated client state, the on-philosophy answer is more server round-trips, not a client state layer.

A component inside a swapped fragment needs no observer at all — `connectedCallback` / `disconnectedCallback` **are** its fragment-change notifications. `MutationObserver` is sanctioned only over a component's own subtree; observing another component's internals couples you to markup you don't own.

## Components in popins and XHR-injected content

Custom elements inside a popin-injected body **upgrade automatically** — the platform handles it on DOM insertion, whatever template engine rendered the fragment server-side. The reference component's e2e coverage drives this against the real built bundle.

A popin body may even carry its **own external definition script**: the popin open path re-creates external `<script src>` tags in `<head>` with a global dedup guard, so the definition loads once and already-inserted elements upgrade retroactively.

One authoring caveat, engine-level not component-level: literal `{{ }}` in markup is interpreted server-side by the template engines. The hydration conventions above (attributes, `data-*` JSON, slots) carry no `{{ }}`, so components authored per this guide are immune; if you ever need literal braces client-side, use the engine's raw block.

## Live connections

Open live resources in `connectedCallback` and close them in `disconnectedCallback` — popin close and content replacement then tear your sockets down automatically (handler-bound sockets leak on content replacement unless you wire teardown by hand). Two transports pair naturally with the lifecycle:

- **[WebSocket routes](/guides/websockets)** (`"method": "ws"` in `routing.json`) for bidirectional traffic — carried over HTTP/2 extended CONNECT [where the client negotiates it](/guides/websockets#limitations).
- **`EventSource` / SSE** for server-push-only cases — the HTTP/1.1-compatible alternative, served by [`self.renderStream()`](/guides/controller#selfrenderstreamasynciterable-contenttype).

Either way, render incoming data with the same `<template>`-clone idiom — and live data is **interactivity, not rankable content** (see the SEO section: what must rank ships in the initial HTML).

### A live-feed component

The partial ships the shell and the entry template, like any other component (`templates/html/includes/x-feed.html`):

```html
<x-feed data-x-feed='{ "url": "/live/lobby" }'>
    <h2>Activity</h2>
    <p data-role="status">Connecting…</p>
    <ul data-role="entries"></ul>
    <template data-role="entry">
        <li><span data-role="entry-label"></span></li>
    </template>
</x-feed>
```

The class opens the connection on insertion and closes it on removal (`public/js/components/x-feed.js`). Do **not** guard the open with a `_bound`-style flag — unlike one-time listener binding, a live connection must re-open on every re-insertion: a component that moves, or comes back in a reopened popin, gets a fresh `connectedCallback` / `disconnectedCallback` pair, and that pair *is* the connection's lifecycle:

```js
(function () {
    'use strict';

    class XFeed extends HTMLElement {

        connectedCallback() {
            var config = {};
            try {
                config = JSON.parse(this.getAttribute('data-x-feed') || '{}');
            } catch (err) {
                config = {};
            }

            this._status   = this.querySelector('[data-role="status"]');
            this._list     = this.querySelector('[data-role="entries"]');
            this._template = this.querySelector('template[data-role="entry"]');

            var self   = this;
            var scheme = /^https:$/.test(window.location.protocol) ? 'wss://' : 'ws://';
            this._socket = new WebSocket(scheme + window.location.host + (config.url || '/live/lobby'));
            this._socket.addEventListener('open', function () {
                self._status.textContent = 'Live';
            });
            this._socket.addEventListener('message', function (event) {
                self._append(String(event.data));
            });
            this._socket.addEventListener('close', function () {
                self._status.textContent = 'Disconnected';
            });
        }

        disconnectedCallback() {
            // popin close / content replacement removed the element — the
            // socket never outlives the markup it feeds
            if (this._socket) {
                this._socket.close(1000, 'component removed');
                this._socket = null;
            }
        }

        _append(label) {
            var fragment = this._template.content.cloneNode(true);
            fragment.querySelector('[data-role="entry-label"]').textContent = label;
            this._list.appendChild(fragment);
        }
    }

    customElements.define('x-feed', XFeed);
}());
```

Server-side this is the [declarative `method:"ws"` route](/guides/websockets#declarative-routes-in-routingjson) and its channel handler, exactly as the WebSocket guide documents them:

```json
"live-feed": {
    "url":    "/live/:room",
    "method": "ws",
    "param":  { "wsHandler": "feed" }
}
```

```js
// src/<bundle>/channels/feed.js
module.exports = function (session, request) {
    session.send('welcome to ' + request.params.room);
    session.onMessage(function (data) {
        session.send('[' + request.params.room + '] ' + data);
    });
    session.onClose(function (code, reason) {
        // release anything the connection held (timers, subscriptions)
    });
};
```

The framework's test suite executes this exact pairing — the handler above over a live HTTP/2 extended-CONNECT loopback, driven through two full connect → close(1000) → re-connect cycles — so the lifecycle contract is locked, not aspirational.

### The `EventSource` alternative

When traffic is one-way (server → component), skip WebSocket entirely: an SSE endpoint is a plain controller action streaming through [`self.renderStream()`](/guides/controller#selfrenderstreamasynciterable-contenttype), whose default content type is already `text/event-stream` — and it works over HTTP/1.1 and HTTP/2 alike:

```js
Controller.prototype.events = function (req, res, next) {
    var self = this;
    async function* feed() {
        for (var i = 0; i < 100; i++) {
            yield JSON.stringify({ tick: i });   // one SSE `data:` frame each
            await new Promise(function (r) { setTimeout(r, 1000); });
        }
    }
    self.renderStream(feed()); // default content type: text/event-stream
};
```

The component-side lifecycle is identical — only the transport object changes:

```js
connectedCallback() {
    var self = this;
    this._source = new EventSource('/events');
    this._source.addEventListener('message', function (event) {
        self._append(event.data);
    });
}

disconnectedCallback() {
    if (this._source) {
        this._source.close();
        this._source = null;
    }
}
```

Closing matters even more here: an orphaned `EventSource` **auto-reconnects forever**.

### Batching high-frequency streams

Per-message clone-and-insert is fine at human-scale rates (chat, notifications, activity feeds). At tens to hundreds of messages per second it thrashes layout — one DOM insertion per message. Coalesce instead: queue what arrives, flush **once per animation frame**, and build the batch into a `DocumentFragment` so the live region is touched once per frame, not once per message:

```js
_append(label) {
    this._pending = this._pending || [];
    this._pending.push(label);
    var self = this;
    if (!this._rafId) {
        this._rafId = requestAnimationFrame(function () { self._flush(); });
    }
}

_flush() {
    this._rafId = null;
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < this._pending.length; i++) {
        var entry = this._template.content.cloneNode(true);
        entry.querySelector('[data-role="entry-label"]').textContent = this._pending[i];
        fragment.appendChild(entry);
    }
    this._pending.length = 0;
    this._list.appendChild(fragment); // one insertion per frame
}

disconnectedCallback() {
    if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
    }
    this._pending = [];
    // …then close the socket as above
}
```

Cap what you keep, too — trim entries beyond a few hundred, or an unbounded live list becomes a client-side memory leak with a scrollbar.

## Inspecting components (dev mode)

In development, the [Inspector](/guides/inspector)'s **View tab** carries a component census — instances per custom-element tag, with components **awaiting upgrade counted in red** (the platform's `:not(:defined)` state: a typo'd tag name or a missing/failed definition script is otherwise a perfectly silent failure — the element just sits inert). The **Events tab** additionally lists your components' protocol traffic: composed, bubbling `<tag>:<verb>` CustomEvents with the emitting element and a timestamp. Event `detail` values are captured only when `settings.json > inspector.events.captureArgs` is enabled — the same opt-in that gates server-side event metadata — and pass the Inspector's redaction rules either way. The census and the event feed follow XHR/popin fragment renders automatically.

## Strict CSP compatibility

The conventions are CSP-clean under a strict, nonce'd policy with no `'unsafe-inline'`:

- Definitions are **external files** — under a nonce'd `script-src`, the `<script src>` tag the framework emits for your `javascripts` entries carries the policy's nonce when you use the [Csp plugin](/guides/csp)'s `useNonce`.
- Light-DOM components ride the bundle's normal **external stylesheets** (`style-src 'self'`) — no inline styles needed. The rare shadow-DOM case uses constructable stylesheets (`new CSSStyleSheet()` + `adoptedStyleSheets`), which CSP does not gate.

The reference component's e2e coverage asserts exactly this: hydration and styling under a real nonce'd `Content-Security-Policy` header with zero component-caused violations.

## Naming and browser floor

- Tag names are yours to choose (the spec requires a dash). The **`gina-*` prefix is reserved** for future framework components — pick your own (docs use a neutral `x-`).
- Custom elements v1 are supported by **all evergreen browsers**. The wider set — ElementInternals form association, `adoptedStyleSheets`, declarative shadow DOM — floors at **Safari 16.4 (2023)**. Components are an opt-in per bundle; gina's own browser floor is unchanged.
