'use strict';
/**
 * sync-gina-version.js
 *
 * Reads the current gina package.json version and patches the `ginaVersion`
 * constant in docusaurus.config.js so the version badge in the docs header
 * always reflects the active gina installation — without needing a publish step.
 *
 * Resolution order (first found wins):
 *   1. GINA_PATH env var — point this to whichever worktree you are working in
 *   2. require.resolve('gina/package.json') — the symlinked install in node_modules
 *
 * Usage:
 *   node scripts/sync-gina-version.js
 *
 * Set GINA_PATH to a specific worktree when working across multiple branches:
 *   GINA_PATH=~/Sites/gina/gina-dev npm start
 */

const fs   = require('fs');
const path = require('path');

// ── 1. Resolve gina root ──────────────────────────────────────────────────────
//
// Resolution order (first valid package.json wins):
//   1. GINA_PATH env var           — explicit worktree override
//   2. npm global install           — ~/.npm-global/lib/node_modules/gina (develop branch)
//   3. node_modules/gina            — docs repo devDep (published version, likely stale)

var CANDIDATES = [];

if (process.env.GINA_PATH) {
    CANDIDATES.push(path.resolve(process.env.GINA_PATH));
}

// npm global install (user-local prefix)
var _npmGlobal = path.join(process.env.HOME || '', '.npm-global', 'lib', 'node_modules', 'gina');
CANDIDATES.push(_npmGlobal);

// docs repo node_modules (last resort — published version, may be stale)
try { CANDIDATES.push(path.dirname(require.resolve('gina/package.json'))); } catch(e) {}

var ginaRoot = null;
for (var i = 0; i < CANDIDATES.length; i++) {
    if (fs.existsSync(path.join(CANDIDATES[i], 'package.json'))) {
        ginaRoot = CANDIDATES[i];
        break;
    }
}

if (!ginaRoot || !fs.existsSync(path.join(ginaRoot, 'package.json'))) {
    console.warn('[sync-gina-version] Could not resolve gina root — set GINA_PATH to your worktree path. ginaVersion unchanged.');
    process.exit(0);
}

// ── 2. Read version ───────────────────────────────────────────────────────────

var version;
try {
    version = JSON.parse(fs.readFileSync(path.join(ginaRoot, 'package.json'), 'utf8')).version;
} catch(e) {
    console.warn('[sync-gina-version] Could not read package.json from', ginaRoot, '—', e.message);
    process.exit(0);
}

// ── 3. Patch docusaurus.config.js ─────────────────────────────────────────────

var configPath = path.resolve(__dirname, '..', 'docusaurus.config.js');
var src        = fs.readFileSync(configPath, 'utf8');
var patched    = src.replace(
    /const ginaVersion = '[^']*'/,
    "const ginaVersion = '" + version + "'"
);

if (src === patched) {
    console.log('[sync-gina-version] ginaVersion already at', version);
} else {
    fs.writeFileSync(configPath, patched);
    console.log('[sync-gina-version] ginaVersion updated to', version, '(from', ginaRoot + ')');
}
