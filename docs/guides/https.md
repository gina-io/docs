---
title: HTTPS and HTTP/2
sidebar_label: HTTPS & HTTP/2
sidebar_position: 6
description: How to enable HTTPS and HTTP/2 in Gina, the Node.js MVC framework — certificate setup, protocol negotiation, h2c cleartext mode, and connection tuning.
level: intermediate
prereqs:
  - '[settings.json](/reference/settings)'
  - '[TLS certificate basics](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/TLS)'
---

# HTTPS and HTTP/2

## Overview

Gina uses HTTP/2 as its default protocol and supports HTTPS out of the box. Each bundle or service requires its own certificate (or a wildcard certificate with symlinks). Once HTTPS is configured, HTTP/2 is enabled automatically with no additional steps.

---

## Step 1 — Get a certificate

Gina does not generate certificates. Use a service like [SSL For Free](https://www.sslforfree.com) (free, 90-day certificates) to generate one for your domain.

SSL For Free will give you three files:

```
ca_bundle.crt
certificate.crt
private.key
```

---

## Step 2 — Install the certificate

Place the certificate folder in Gina's certificate directory:

```
~/.gina/certificates/scopes/<scope>/<hostname>/
```

- `<scope>`: `local` for development, `production` for your live host
- `<hostname>`: your bundle's hostname, e.g. `frontend.myproject.app`

**Example:**

```bash
mkdir -p ~/.gina/certificates/scopes/local/frontend.myproject.app
cp ca_bundle.crt certificate.crt private.key ~/.gina/certificates/scopes/local/frontend.myproject.app/
```

---

## Step 3 — Enable HTTPS

Check the current protocol status:

```bash
gina protocol:list @myproject
```

Enable HTTPS for the whole project:

```bash
gina protocol:set @myproject
```

Enable HTTPS for a specific bundle only:

```bash
gina protocol:set frontend @myproject
```

Then restart:

```bash
gina tail
```

In another terminal:

```bash
gina bundle:restart frontend @myproject
```

---

## Local development — fixing certificate errors

When developing locally, you may see:

```
Error: unable to get issuer certificate
```

This happens because the Root Certificate is not included in the downloaded certificate file. Browsers handle this automatically in production, but locally you need to chain it manually.

### Fix: generate a chained certificate

**Step 1** — Copy the content of `certificate.crt`:

```bash
cat ~/.gina/certificates/scopes/local/frontend.myproject.app/certificate.crt
```

**Step 2** — Paste it into [whatsmychaincert.com](https://whatsmychaincert.com) → _Generate the Correct Chain_. Check the **Include Root Certificate** option. Download the result and save it as:

```
~/.gina/certificates/scopes/local/frontend.myproject.app/certificate.chained+root.crt
```

**Step 3** — Combine the private key with the chained certificate:

```bash
cd ~/.gina/certificates/scopes/local/frontend.myproject.app
cat private.key certificate.chained+root.crt > certificate.combined.pem
```

Verify:

```bash
openssl verify -CAfile certificate.combined.pem certificate.crt
# => certificate.crt: OK
```

**Step 4** — Override the certificate path in your bundle config:

Create or edit `myproject/src/frontend/config/settings.server.credentials.dev.json`:

```json
{
  "ca": "${GINA_HOMEDIR}/certificates/scopes/${scope}/${host}/certificate.combined.pem"
}
```

`${GINA_HOMEDIR}`, `${scope}`, and `${host}` are substituted automatically by Gina at runtime.

Then restart all bundles:

```bash
gina bundle:restart @myproject
```

---

## Wildcard certificates

If you have a wildcard certificate (e.g. `*.myproject.app`), you only need to set it up once. Create symlinks for each bundle:

```bash
ln -s ~/.gina/certificates/scopes/local/myproject.app \
      ~/.gina/certificates/scopes/local/frontend.myproject.app
```

---

## HTTP/2

HTTP/2 is enabled automatically once HTTPS is configured. There is nothing extra to turn on.

When a client connects, Gina negotiates `h2` via ALPN. If the client does not support HTTP/2, it falls back to `http/1.1` — controlled by the `allowHTTP1` setting (default `true`). See the [server settings reference](../reference/settings#server) for the full field list.

### What Gina handles for you

- **Protocol negotiation** — `h2` via TLS ALPN, automatic `http/1.1` fallback
- **Session multiplexing** — multiple concurrent requests share a single TCP connection; the framework manages session reuse, idle eviction (120s), and dead-session detection
- **GOAWAY** — if the remote peer closes the connection mid-flight, the request is retried transparently once
- **Forbidden headers** — `Connection`, `Transfer-Encoding`, and other HTTP/1.1-only headers are stripped automatically; you do not need to sanitise them

### What is different for your code

**Pseudo-headers replace standard headers.** On HTTP/2 requests, the client sends `:authority` instead of `Host`, `:method` instead of `Method`, and so on. Gina normalises these for you — `req.headers.host` and `req.method` work as expected in controllers.

**Status messages are suppressed.** HTTP/2 does not transmit a status reason phrase (RFC 9113 §8.3.1). `res.statusMessage` is ignored on HTTP/2 connections. Use meaningful status codes instead.

**`req.headers[':authority']`** is available if you need the raw HTTP/2 pseudo-header value (e.g. for SNI-aware routing or multi-tenant host detection).

### h2c — cleartext HTTP/2

HTTP/2 without TLS is available for internal services behind a TLS-terminating load balancer (nginx, Caddy, Cloudflare) or for local development without a certificate:

```json title="src/api/config/settings.json"
{
  "server": {
    "engine"  : "isaac",
    "protocol": "http/2.0",
    "scheme"  : "http"
  }
}
```

h2c does not use ALPN. The client must explicitly request HTTP/2 (e.g. `--http2-prior-knowledge` with curl). It is not suitable for direct browser traffic.

### Connection settings

The most common settings to tune, set in `settings.json`:

| Setting | Default | When to change |
|---|---|---|
| `allowHTTP1` | `true` | Set `false` on internal h2-only services to reject HTTP/1.1 clients |
| `keepAliveTimeout` | `"5s"` | Increase for long-lived API clients or mobile connections |
| `headersTimeout` | `"5500ms"` | Must stay above `keepAliveTimeout`; increase if slow clients time out during header send |

Full reference: [settings.json → server](../reference/settings#server).

### Coming in 0.3.0

**103 Early Hints** — `Link: <url>; rel=preload` headers will be sent as an informational response before the final HTML, allowing the browser to start fetching CSS and JS while the template is still rendering. No action needed on your part — the framework handles it automatically for bundles that declare static assets.

**Configurable stream limits** — `maxConcurrentStreams` and `initialWindowSize` will be movable to `settings.server.json` per bundle.
