'use strict';
/**
 * generate-api-docs.js
 *
 * Reads JSDoc from the gina framework library modules and writes one Markdown
 * file per module into docs/api/.  Run automatically as the `prebuild` npm
 * script so Vercel always has fresh API docs before the Docusaurus build.
 *
 * Each module is rendered in an isolated child process to prevent jsdoc state
 * from carrying over between calls.  The overview index (index.md) is also
 * generated dynamically so it only links to modules that actually produced output.
 */

const { spawnSync } = require('child_process');
const fs            = require('fs');
const path          = require('path');

// Resolve the installed gina package root
const ginaRoot = path.dirname(require.resolve('gina/package.json'));

// Locate the framework version directory (there is always exactly one)
const fwBase      = path.join(ginaRoot, 'framework');
const [fwVersion] = fs.readdirSync(fwBase).filter(d => d.startsWith('v')).sort();
const libBase     = path.join(fwBase, fwVersion, 'lib');

// Modules to document. `files` is relative to libBase.
const MODULES = [
  { id: 'merge',      title: 'Merge',      desc: 'Deep-merge two or more objects or arrays',      files: ['merge/src/main.js']      },
  { id: 'collection', title: 'Collection', desc: 'Ordered collection with query helpers',          files: ['collection/src/main.js'] },
  { id: 'logger',     title: 'Logger',     desc: 'Multi-stream structured logging',                files: ['logger/src/main.js'],     manual: true },
  { id: 'routing',    title: 'Routing',    desc: 'Route dispatcher and URL builder',               files: ['routing/src/main.js']    },
  { id: 'cache',      title: 'Cache',      desc: 'In-memory and filesystem caching',               files: ['cache/src/main.js']      },
  { id: 'cron',       title: 'Cron',       desc: 'Scheduled task runner',                          files: ['cron/src/main.js']       },
  { id: 'archiver',   title: 'Archiver',   desc: 'File archiving (tar, zip)',                      files: ['archiver/src/main.js']   },
  { id: 'domain',     title: 'Domain',     desc: 'Domain and public-suffix validation',            files: ['domain/src/main.js']     },
  { id: 'math',       title: 'Math',       desc: 'Math utility helpers',                           files: ['math/index.js']          },
  { id: 'url',        title: 'URL',        desc: 'URL parsing and manipulation',                   files: ['url/index.js']           },
  { id: 'uuid',       title: 'UUID',       desc: 'Lightweight cryptographic ID generator',          files: ['uuid/src/main.js'],       manual: true },
];

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'api');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Inline script run in each child process: renders one file and prints markdown to stdout.
// Patches are applied to a temp copy of each source file so invalid JSDoc annotations
// in older published versions of gina do not abort the entire render.
const RENDER_SCRIPT = `
const j    = require('jsdoc-to-markdown');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const PATCHES = [
  // @package gina.lib — invalid value on the @package tag; replace with @memberof
  { re: /(@package)\\s+gina\\.lib/g, to: '@memberof module:lib' },
  // bare @returns with no type/description — jsdoc-to-markdown chokes on it
  { re: /(@returns)\\s*$/gm, to: '@returns {void}' },
];

function patchedCopy(src) {
  let text = fs.readFileSync(src, 'utf8');
  let patched = false;
  for (const { re, to } of PATCHES) {
    const out = text.replace(re, to);
    if (out !== text) { text = out; patched = true; }
  }
  if (!patched) return src;
  const tmp = path.join(os.tmpdir(), 'gina-apidoc-' + path.basename(src));
  fs.writeFileSync(tmp, text, 'utf8');
  return tmp;
}

const origFiles = process.argv.slice(1);
const files     = origFiles.map(patchedCopy);

j.render({ files, 'no-cache': true, 'module-index-format': 'dl' })
  .then(md => { process.stdout.write(md || ''); })
  .catch(err => { process.stderr.write(err.message); process.exit(1); })
  .finally(() => {
    // clean up temp copies
    files.forEach((f, i) => { if (f !== origFiles[i]) try { fs.unlinkSync(f); } catch(_) {} });
  });
`;

const successful = [];

for (const mod of MODULES) {
  // Skip generation for manually-maintained pages; preserve the existing file as-is.
  if (mod.manual) {
    const manualPath = path.join(OUTPUT_DIR, `${mod.id}.md`);
    if (fs.existsSync(manualPath)) {
      console.log(`[api-docs] skip ${mod.id}: manual page preserved`);
      successful.push(mod);
    } else {
      console.warn(`[api-docs] skip ${mod.id}: marked manual but file not found`);
    }
    continue;
  }

  const sourcePaths = mod.files
    .map(f => path.join(libBase, f))
    .filter(f => fs.existsSync(f));

  if (sourcePaths.length === 0) {
    console.warn(`[api-docs] skip ${mod.id}: source file(s) not found`);
    continue;
  }

  const result = spawnSync(process.execPath, ['-e', RENDER_SCRIPT, ...sourcePaths], {
    encoding: 'utf8',
    timeout: 30000,
  });

  if (result.status !== 0 || result.error) {
    const errMsg = (result.stderr || result.error?.message || 'unknown error').trim();
    console.warn(`[api-docs] skip ${mod.id}: ${errMsg.split('\n')[0]}`);
    continue;
  }

  const md = result.stdout;
  if (!md || !md.trim()) {
    console.warn(`[api-docs] skip ${mod.id}: no JSDoc output produced`);
    continue;
  }

  // jsdoc-to-markdown emits `<a name="X"></a>` legacy anchors followed by a
  // heading; Docusaurus does not honor those when checking links, so the
  // in-page cross-references it also generates (`[X](#X)`) come up broken.
  // Rewrite each pair into Docusaurus heading-id syntax so the same anchors
  // resolve natively.
  const mdProcessed = md.replace(
    /<a name="([^"]+)"><\/a>\s*\n+(#{2,6} [^\n]+)/g,
    '$2 {#$1}'
  );

  const frontmatter =
    `---\nid: ${mod.id}\ntitle: ${mod.title}\nsidebar_label: ${mod.title}\nformat: md\n---\n\n`;

  fs.writeFileSync(path.join(OUTPUT_DIR, `${mod.id}.md`), frontmatter + mdProcessed);
  console.log(`[api-docs] generated docs/api/${mod.id}.md`);
  successful.push(mod);
}

// Generate index.md dynamically — only links modules that produced output
const tableRows = successful
  .map(m => `| [${m.title}](./${m.id}.md) | ${m.desc} |`)
  .join('\n');

const indexContent =
`---
id: api-overview
title: API Reference
sidebar_label: Overview
slug: /api
---

# API Reference

This section documents the public libraries bundled with the Gina framework.
Each page is auto-generated from JSDoc at build time.

| Module | Description |
|---|---|
${tableRows}

For globally injected functions (no \`require()\` needed), see [Globals](/globals).
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'index.md'), indexContent);
console.log(`[api-docs] done — ${successful.length} module(s) documented`);
