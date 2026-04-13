'use strict';
/**
 * sync-versions.js
 *
 * Reads the current gina and @rhinostone/swig package.json versions and patches
 * the `ginaVersion` / `swigVersion` constants in docusaurus.config.js so the
 * version badges in the docs header always reflect the active local
 * installations — without needing a publish step.
 *
 * Resolution order for each package (first valid package.json wins):
 *   1. <PKG>_PATH env var   — explicit worktree override (GINA_PATH, SWIG_PATH)
 *   2. ~/.npm-global install — user-local global install
 *   3. ~/Sites/gina/<name>   — local worktree sibling
 *   4. require.resolve       — docs repo node_modules devDep (likely stale)
 *
 * Usage:
 *   node scripts/sync-versions.js
 *
 * Set <PKG>_PATH to point at a specific worktree when working across branches:
 *   GINA_PATH=~/Sites/gina/gina-dev npm start
 *   SWIG_PATH=~/Sites/gina/swig     npm start
 */

const fs   = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '..', 'docusaurus.config.js');

function syncVersion(opts) {
    var label      = opts.label;
    var configKey  = opts.configKey;
    var candidates = opts.candidates.filter(Boolean);

    var pkgRoot = null;
    for (var i = 0; i < candidates.length; i++) {
        if (fs.existsSync(path.join(candidates[i], 'package.json'))) {
            pkgRoot = candidates[i];
            break;
        }
    }

    if (!pkgRoot) {
        console.warn('[sync-versions] Could not resolve', label, 'root — set', label.toUpperCase() + '_PATH to your worktree.', configKey, 'unchanged.');
        return;
    }

    var version;
    try {
        version = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')).version;
    } catch (e) {
        console.warn('[sync-versions] Could not read package.json from', pkgRoot, '—', e.message);
        return;
    }

    var src     = fs.readFileSync(CONFIG_PATH, 'utf8');
    var re      = new RegExp('const ' + configKey + " = '[^']*'");
    var patched = src.replace(re, 'const ' + configKey + " = '" + version + "'");

    if (src === patched) {
        console.log('[sync-versions]', configKey, 'already at', version);
    } else {
        fs.writeFileSync(CONFIG_PATH, patched);
        console.log('[sync-versions]', configKey, 'updated to', version, '(from', pkgRoot + ')');
    }
}

var HOME = process.env.HOME || '';

syncVersion({
    label: 'gina',
    configKey: 'ginaVersion',
    candidates: [
        process.env.GINA_PATH && path.resolve(process.env.GINA_PATH),
        path.join(HOME, '.npm-global', 'lib', 'node_modules', 'gina'),
        path.join(HOME, 'Sites', 'gina', 'gina-dev'),
        (function () { try { return path.dirname(require.resolve('gina/package.json')); } catch (e) { return null; } })()
    ]
});

syncVersion({
    label: 'swig',
    configKey: 'swigVersion',
    candidates: [
        process.env.SWIG_PATH && path.resolve(process.env.SWIG_PATH),
        path.join(HOME, 'Sites', 'gina', 'swig'),
        path.join(HOME, '.npm-global', 'lib', 'node_modules', '@rhinostone', 'swig'),
        (function () { try { return path.dirname(require.resolve('@rhinostone/swig/package.json')); } catch (e) { return null; } })()
    ]
});
