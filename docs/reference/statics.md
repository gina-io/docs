---
title: statics.json
sidebar_label: statics.json
sidebar_position: 5
description: Reference for statics.json — maps URL paths to filesystem directories so a Gina bundle can serve CSS, images, JavaScript, and font files without routing through a controller.
level: intermediate
prereqs:
  - '[Projects and bundles](/concepts/projects-and-bundles)'
  - '[Views guide](/guides/views)'
---

# statics.json

Maps URL paths to filesystem directories so the server knows where to find static assets (CSS, images, JavaScript, font files, etc.). Requests matching a declared static path bypass the router and controller entirely, and the file is served directly from the mapped directory.

```
src/<bundle>/config/statics.json
```

---

## How it works

Each entry in `statics.json` is a `"url-path": "filesystem-path"` pair.
When a request arrives for a URL that starts with a declared path, the file is
read directly from the mapped directory — **bypassing the router and controller entirely**.

```mermaid
flowchart LR
    A(["HTTP request"]) --> B{"URL matches\na static path?"}

    B -- "yes — served directly" --> C["Read file from\nmapped directory"]
    C --> D(["HTTP response"])

    B -- "no" --> E
    subgraph E["Normal pipeline"]
        direction LR
        E1["Router"] --> E2["Middleware"] --> E3["Controller"]
    end
    E --> D
```

The lookup is prefix-based: `"css"` in `statics.json` matches any request whose
URL starts with `/css/`, regardless of the filename.

---

## Minimal example

```json title="src/frontend/config/statics.json"
{
  "css" : "${bundlePath}/public/css",
  "js"  : "${bundlePath}/public/js",
  "img" : "${bundlePath}/public/img"
}
```

`GET /css/main.css` → serves `${bundlePath}/public/css/main.css`.
`GET /js/app.js` → serves `${bundlePath}/public/js/app.js`.

[Path template variables](./index.md#path-template-variables) like `${bundlePath}`
are substituted at startup.

The empty-string key `""` maps the bundle root URL — useful for top-level files:

```json
{
  "": "${publicPath}"
}
```

`GET /favicon.ico` → served from `${publicPath}/favicon.ico`.

---

## Fields

| Key | Value | Description |
|---|---|---|
| any URL path string | filesystem path string | Maps `/<key>/` requests to the given directory |
| `""` (empty string) | filesystem path string | Maps the bundle root URL (used for `favicon.ico`, `robots.txt`, etc.) |

URL path keys do **not** need a leading or trailing slash — the framework normalises
them at startup.

---

## Framework defaults

The framework merges a baseline below your `statics.json`. Your entries always win
when the same key appears in both.

```mermaid
flowchart LR
    A["src/&lt;bundle&gt;/config/statics.json\n(your entries)"] --> M["merge\nyour entries win"]
    B["core/template/conf/statics.json\n(framework defaults)"] --> M
    M --> C["Active statics map"]
```

| Key | Resolves to | Purpose |
|---|---|---|
| `html` | `${templatesPath}/html` | Template HTML files |
| `sass` | `${templatesPath}/sass` | SASS source files |
| `handlers` | `${handlersPath}` | Client-side JS handlers |
| `css/vendor/gina` | `${gina}/framework/v${version}/core/asset/plugin/dist/vendor/gina/css` | Gina's built-in CSS |
| `js/vendor/gina` | `${gina}/framework/v${version}/core/asset/plugin/dist/vendor/gina/js` | Gina's built-in JS |
| `""` | `${publicPath}` | Bundle public directory |

You never need to declare these yourself unless you want to override one.

---

## Cross-bundle static sharing

To serve assets from another bundle (e.g. sharing a design system's CSS into an
`auth` bundle), point the value at that bundle's directory directly.

```json title="src/auth/config/statics.json"
{
  "css"        : "${bundlePath}/public/css",
  "js"         : "${bundlePath}/public/js",
  "shared/css" : "/absolute/path/to/dashboard/public/css"
}
```

`GET /shared/css/theme.css` → served from the dashboard's CSS directory.

To share across **all** bundles without duplication, use `shared/config/statics.json`:

```json title="shared/config/statics.json"
{
  "js/vendor": "${bundlePath}/../../shared/public/vendor/js"
}
```

---

## Caching behaviour

The static file server sends different cache headers depending on the environment.

### Production (`NODE_ENV_IS_DEV` not set)

Every static response includes `ETag` and `Last-Modified` headers. Subsequent requests
from the browser are answered with **304 Not Modified** when the file has not changed —
saving bandwidth and reducing latency for returning visitors.

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as Gina (prod)

    B->>G: GET /js/app.js
    G-->>B: 200 OK<br/>ETag: "12345-1711900000000"<br/>Last-Modified: Tue, 01 Apr 2025 00:00:00 GMT

    Note over B: File cached with ETag + Last-Modified

    B->>G: GET /js/app.js<br/>If-None-Match: "12345-1711900000000"
    G-->>B: 304 Not Modified<br/>(no body)
```

**ETag format** — `"<size>-<mtime>"` (size in bytes, mtime in milliseconds). This is a
strong identity check: any change to the file produces a new ETag.

**Precedence** — `If-None-Match` (ETag) is checked first. `If-Modified-Since` is only
evaluated when `If-None-Match` is absent.

A file served without a `Cache-Control` header can also be reused with no
request at all: browsers give it a lifetime of their own, estimated from its
`Last-Modified` date ([RFC 9111 § 4.2.2](https://www.rfc-editor.org/rfc/rfc9111#section-4.2.2)
suggests 10 % of the time since then). After a deploy, a returning browser can
therefore run the previous version of a file for a while.
[Versioned URLs](#versioned-asset-urls) avoid this for the stylesheets and scripts
gina writes into pages.

### Dev mode (`NODE_ENV_IS_DEV=true`)

All static responses carry `cache-control: no-cache, no-store, must-revalidate` —
the browser never caches and always fetches fresh. This ensures that file edits are
reflected immediately without a hard-reload.

For `.js` and `.css` files that have a corresponding `.map` file, the `X-SourceMap`
header is also set so browser DevTools can load the source map.

### Versioned asset URLs

*New in 0.7.2.* In production, the `<link>` and `<script>` tags gina writes for
the stylesheets and scripts declared in [`templates.json`](/reference/templates)
carry a **content token**: `?v=` followed by the first 10 hexadecimal characters
of the file's SHA-384 (`&v=` when the URL already has a query string). The token
changes only when the file's bytes change, so a browser can keep the file for a
year, and a deploy that changes a file changes its URL — the next page names the
new one.

```html
<script defer type="text/javascript" src="/js/vendor/gina/gina.min.js?v=e602d1b9ee" data-gina-routing-v="1f3c5a7b9d"></script>
<link href="/css/app.css?v=99bf1f0781" rel="stylesheet" type="text/css">
```

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as Gina (prod)

    B->>G: GET /page
    G-->>B: <script src="/js/app.js?v=6a0bf42b46">
    B->>G: GET /js/app.js?v=6a0bf42b46
    G-->>B: 200 OK<br/>Cache-Control: public, max-age=31536000, immutable
    Note over B: Later views use the cached file —<br/>no request at all
    Note over G: A deploy changes app.js
    B->>G: GET /page
    G-->>B: <script src="/js/app.js?v=c41d07e2a9">
    B->>G: GET /js/app.js?v=c41d07e2a9
    G-->>B: 200 OK — the new bytes, cached for a year
```

For a static file gina serves itself, the token decides the cache header:

| Request | Response |
|---|---|
| `?v=` naming the file's current bytes | `200` + `Cache-Control: public, max-age=31536000, immutable` |
| `?v=` with any other 10-hex token — a page rendered before a deploy, an old link | `200` + `Cache-Control: no-cache` + `ETag`: the browser revalidates, and never keeps stale bytes for a year |
| No `v`, or a `v` that is not a 10-hex token (your own `?v=2`) | Unchanged: `ETag` + `Last-Modified`, no `Cache-Control` |

A revalidation of a versioned URL (`If-None-Match`) is answered `304` as before;
over HTTP/2, the `304` for the current token repeats
`Cache-Control: public, max-age=31536000, immutable`. The HTTP/2 preload
hints — the `link` response header and `103 Early Hints` — name the same
versioned URLs as the tags, so no asset is fetched twice.

**The routing table.** The client fetches `/_gina/assets/routing.json` on every
page load. Gina's own `<script>` tag carries the table's token in
`data-gina-routing-v`, the client appends it, and the server answers
`max-age=31536000, immutable` (`private` behind a proxy, `public` otherwise)
for the token of the table it serves. A routing change mints a new token; a
restart with the same routes keeps it. A page the browser has cached keeps
using the table it was rendered with until the page itself expires.

**What is not versioned** — these keep their plain URLs:

- a `javascripts` entry marked `isExternalPlugin` (gina splices it into the
  layout it compiles, which the render cache can keep for a long time);
- a render without a layout (`isWithoutLayout` — a popin body, a fragment);
- tags you write by hand in a layout, and the images and fonts your CSS
  references;
- a file gina cannot find on disk (an external URL, a missing file) or one
  larger than 8 MiB;
- every page in dev mode, where statics are served `no-store` anyway;
- a bundle that sets `"assetVersioningEnabled": false` in
  `templates.json > _common`.

**Precompressed files.** Over HTTP/1.1, gina serves `app.js.br` or `app.js.gz`
instead of `app.js` when the browser accepts that encoding and the file exists.
Under a matching token the compressed file is served `immutable` only when it is
not older than `app.js`, compared in whole seconds (compression tools that keep
their source's timestamp truncate it); an older one is served `no-cache`, since
it may predate the current source. Regenerate compressed files whenever you
rebuild their source.

**Serving statics from nginx.** When nginx serves your static files from disk, a
versioned URL changes nothing until nginx sends the cache header, and nginx cannot
tell a current token from a stale one. Send the requests that carry a token to the
bundle, which checks it, and keep serving every other request from disk:

```nginx
# A gina content token is 10 lower-case hexadecimal characters.
# Quote the regular expression: nginx rejects unquoted braces here.
map $arg_v $gina_versioned {
    "~^[0-9a-f]{10}$"  1;
    default            0;
}

server {
    # ...
    location ^~ /css/ {
        root /var/www/myproject/public;
        add_header Cache-Control "no-cache";   # your headers for plain requests, unchanged

        error_page 418 = @gina_versioned;      # a token: hand the request to the bundle
        if ($gina_versioned) {
            return 418;
        }
    }
    # ...the same error_page and if in every location that serves files gina versions:
    # the stylesheets and scripts declared in templates.json, and gina's own
    # js/vendor/gina and css/vendor/gina

    location @gina_versioned {
        proxy_pass http://myproject_bundle;    # the bundle that renders the pages
    }
}
```

The bundle answers `immutable` only when the token names the file's current bytes,
and `no-cache` to any other token. So the old tokens of a page rendered before a
deploy, or those a revert brings back, never pin the wrong file for a year. Each
browser fetches a versioned file from the bundle once per version and uses its own
copy afterwards. The bundle also picks the precompressed file, as described above.

- **Put them inside the location that serves the files.** When the longest
  matching prefix location is marked `^~`, nginx does not check regular-expression
  locations, so a separate `location ~* \.(js|css)$` never applies to those paths.
- **Add no `Cache-Control` in the named location.** gina sets it, and an
  `add_header Cache-Control` there sends a second one. A block that declares any
  `add_header` inherits none from the `server` block, so a named location that
  declares none keeps your server's headers.
- **An `error_page` inside a location replaces the server's `error_page` directives
  there.** Repeat the ones the location relies on, a custom 404 page for example,
  next to the `error_page 418`.
- Proxy with the settings your other proxied locations use (scheme, `Host`, TLS).
  A request without a token, with an upper-case one, or with your own `?v=2` is
  still served from disk, as before.
- Inside a `location`, `if` is safe only with `return` or `rewrite … last`, which is
  why the request leaves through `error_page 418`.

**Keying the cache header on the token's shape** works with nginx alone, but nginx
cannot check the token:

```nginx
map $arg_v $gina_asset_cache {
    "~^[0-9a-f]{10}$"  "public, max-age=31536000, immutable";
    default            "no-cache";
}
# in each location that serves the files:
#     add_header Cache-Control $gina_asset_cache;
```

nginx then answers any 10-hex token with the file it has on disk, for a year. A page
rendered before the files changed (kept by the render cache, served by a replica
still on the old release, or loading during the deploy) names the old tokens, and
the browsers that request them after the deploy keep the new bytes under the old
token. A revert that restores the old files brings those tokens back, and those
browsers keep running the reverted-away file, with no request, for up to a year.
The rule also requires nginx to serve exactly the bytes gina hashed at every moment
of a deploy, and precompressed files rebuilt with their source: `gzip_static` serves
a stale `.gz` under the current token for a year. Prefer the recipe above.

**Rebuilding assets without a restart.** Tokens follow the file (each is cached
and re-validated against the file's size and modification time), so a rebuilt
asset gets its new token on the next render. Pages already stored by the
[render cache](/guides/caching) keep the tokens they were rendered with until you
flush that cache or restart, as for
[Subresource Integrity](/reference/templates#subresource-integrity-srienabled).
Where gina checks the tokens (the statics it serves itself, and the nginx recipe
above), those pages' assets are revalidated instead of cached for a year; nginx
keying the header on the token's shape caches them for a year.

### Summary

| Environment | Headers sent | Browser behaviour |
|---|---|---|
| Production | `ETag`, `Last-Modified` | 304 on unchanged files; reused with no request while the browser's own estimate of freshness lasts |
| Production, versioned URL (`?v=` + the file's current token) | `Cache-Control: public, max-age=31536000, immutable`, `ETag`, `Last-Modified` | No request until the URL changes |
| Dev | `cache-control: no-cache, no-store, must-revalidate` + `X-SourceMap` (JS/CSS only) | Always re-fetches |

---

## Extended example

```json title="src/dashboard/config/statics.json"
{
  "css"       : "${bundlePath}/public/css",
  "js"        : "${bundlePath}/public/js",
  "img"       : "${bundlePath}/public/img",
  "js/vendor" : "${bundlePath}/public/vendor/js",
  "fonts"     : "${bundlePath}/public/fonts",
  "downloads" : "${tmpPath}/downloads"
}
```
