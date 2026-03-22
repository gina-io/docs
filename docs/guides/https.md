---
sidebar_position: 6
---

# HTTPS and HTTP/2

## Overview

Gina supports HTTPS and an experimental HTTP/2 implementation. Each bundle or service requires its own certificate (or a wildcard certificate with symlinks).

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

HTTP/2 requires HTTPS to be enabled first. Once HTTPS is working, Gina's experimental HTTP/2 implementation can be enabled via your bundle's server settings.

> HTTP/2 support is experimental in the current alpha.
