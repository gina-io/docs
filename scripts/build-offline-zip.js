'use strict';
/**
 * build-offline-zip.js — postbuild step for #V10 (Docs offline ZIP).
 *
 * Runs automatically AFTER `docusaurus build` (wired as the npm "postbuild"
 * hook, so it fires on both Vercel deploys and the build-check CI). It produces
 * a self-contained, file://-browsable copy of the documentation and drops it
 * into the live build output as a one-click downloadable artifact:
 *
 *   1. Build a SECOND time with docusaurus.offline.config.js (hash router →
 *      relative asset paths + no runtime search) into an OS-temp directory.
 *   2. Zip that directory (under a single top-level `gina-docs/` folder) into
 *      build/downloads/gina-docs-offline.zip.
 *   3. Remove the temp directory.
 *
 * The zip is served at https://gina.io/docs/downloads/gina-docs-offline.zip
 * (Vercel static hosting + the Cloudflare `/docs/*` passthrough — no worker
 * change needed) and linked from docs/download-offline.md.
 *
 * Notes:
 *   • The offline build writes to a temp dir (not build/), so the zip never
 *     contains itself and the repo tree stays clean.
 *   • The production build/ output is untouched — postbuild runs after it, and
 *     only ADDS build/downloads/gina-docs-offline.zip.
 *   • adm-zip is a zero-dependency, pure-JS zipper (no reliance on a system
 *     `zip` binary being present on the build host).
 */

const { execFileSync } = require('child_process');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const AdmZip = require('adm-zip');

const REPO_ROOT   = path.resolve(__dirname, '..');
const OFFLINE_CFG = path.join(REPO_ROOT, 'docusaurus.offline.config.js');
const BUILD_DIR   = path.join(REPO_ROOT, 'build');
const OUT_DIR     = path.join(BUILD_DIR, 'downloads');
const ZIP_PATH    = path.join(OUT_DIR, 'gina-docs-offline.zip');
const TOP_DIR     = 'gina-docs'; // single top-level folder inside the archive

function log(msg) {
  console.log('[build-offline-zip] ' + msg);
}

function main() {
  if (!fs.existsSync(OFFLINE_CFG)) {
    throw new Error('Missing offline config: ' + OFFLINE_CFG);
  }
  if (!fs.existsSync(BUILD_DIR)) {
    // postbuild must run after a successful `docusaurus build`; bail loudly.
    throw new Error('No build/ directory — postbuild must run after `docusaurus build`.');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gina-docs-offline-'));
  try {
    log('building offline bundle (hash router) -> ' + tmpDir);
    execFileSync(
      'npx',
      ['--no-install', 'docusaurus', 'build', '--config', OFFLINE_CFG, '--out-dir', tmpDir],
      { cwd: REPO_ROOT, stdio: 'inherit' }
    );

    log('zipping -> ' + path.relative(REPO_ROOT, ZIP_PATH));
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const zip = new AdmZip();
    zip.addLocalFolder(tmpDir, TOP_DIR);
    zip.writeZip(ZIP_PATH);

    const mb = (fs.statSync(ZIP_PATH).size / 1048576).toFixed(1);
    log('done: ' + mb + ' MB at ' + path.relative(REPO_ROOT, ZIP_PATH));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (err) {
  console.error('[build-offline-zip] FAILED: ' + (err && err.message ? err.message : err));
  process.exit(1);
}
