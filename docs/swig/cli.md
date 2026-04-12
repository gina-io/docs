---
title: CLI
sidebar_label: CLI
sidebar_position: 9
description: The swig command-line tool — compile, render, or run templates from the shell. Options, examples, and pre-compiling templates for the browser.
level: intermediate
prereqs:
  - '[Getting Started](./getting-started)'
---

import DocMeta from '@site/src/components/DocMeta';

<DocMeta
  minutes={4}
  level="intermediate"
  prereqs={['[Getting Started](./getting-started)']}
/>

# CLI

The `swig` CLI compiles, renders, and runs templates from the command line. It is installed as a global binary when you `npm install --global @rhinostone/swig` (or `npm link` from the repo).

## Installation

```bash
npm install --global @rhinostone/swig
```

Verify:

```bash
swig --version
# => 1.5.0
```

## Subcommands

```bash
swig compile [file…] [options]   # Compile to a JS function, write to stdout or --output
swig render  [file…] [options]   # Compile + render with a locals context
swig run     [file…] [options]   # Execute a pre-compiled template file
```

```mermaid
flowchart LR
  SRC[template.html] -->|swig compile| JS[Compiled JS function]
  SRC -->|swig render --json=data.json| HTML[Rendered HTML]
  JS -->|swig run| HTML
```

## Options

| Flag | Alias | Default | Purpose |
| --- | --- | --- | --- |
| `--version` | `-v` | — | Print the package version. |
| `--output <dir>` | `-o` | `stdout` | Output directory or file. |
| `--help` | `-h` | — | Show the help screen. |
| `--json <file>` | `-j` | — | Locals context as a JSON file. |
| `--context <file>` | `-c` | — | Locals context as a CommonJS module. Only used when `--json` is absent. |
| `--minify` | `-m` | — | Minify compiled output with `terser`. |
| `--filters <file>` | — | — | CommonJS module of custom filters. Each export becomes a filter. |
| `--tags <file>` | — | — | CommonJS module of custom tags. Each export must have `parse`, `compile`, optional `ends`, `block`. |
| `--options <file>` | — | — | CommonJS module of options — passed to `swig.setDefaults`. |
| `--wrap-start <str>` | — | `"var tpl = "` | Prefix for `compile` output. |
| `--wrap-end <str>` | — | `";"` | Suffix for `compile` output. |
| `--method-name <name>` | — | `"tpl"` | Shorthand for `--wrap-start="var <name> = "`. Cannot combine with `--wrap-start`. |

## Examples

Render a single file to stdout:

```bash
swig render ./index.html --json=./data.json
```

Compile and cache a template, minified:

```bash
swig compile ./index.html -m > ./cache/index.js
```

Run a previously compiled template:

```bash
swig run ./cache/index.js
```

Render with a CommonJS context (useful when the context depends on runtime code):

```bash
swig render ./index.html --context=./locals.js
```

Make the compiled output an AMD module:

```bash
swig compile ./index.html \
  --wrap-start="define(function () { return " \
  --wrap-end="; });"
```

Compile with a custom filter and tag set:

```bash
swig compile ./page.html \
  --filters=./my-filters.js \
  --tags=./my-tags.js \
  --options=./swig-options.js
```

## Pre-compiling for the browser

The CLI's primary browser use-case is compiling templates at build time so the browser loads only the compiled JS — see [Browser Usage](./browser) for the full workflow.

```bash
swig compile myfile.html --method-name=myfile > myfile.js
```

## Security notes

- `swig run` evaluates the contents of the template file via `eval`. **Never pass untrusted input to `swig run`.** See [Security](./security#swig-run-is-not-a-sandbox).
- `--context`, `--filters`, `--tags`, and `--options` all `require()` the file you point them at — running them executes the module. The CLI is a developer tool; all inputs are assumed to come from the local user.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| non-zero | Parse error, missing file, or unknown option. |
